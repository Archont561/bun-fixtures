import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import {
  CassetteError,
  createFixture,
  fnv1a,
  slugifyFilename,
} from "@bun-test-utils/core";
import {
  type CallbackSerializer,
  createSerializerCodec,
  type SerializerCodec,
} from "./serializers.ts";

export type VcrMode = "record" | "replay" | "passthrough";

export interface RecordedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface RecordedResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}

export interface CassetteEntry {
  request: RecordedRequest;
  response: RecordedResponse;
}

export interface CassetteHelper {
  /**
   * Execute a callback and remember its result. A callback object the test has
   * not recorded always runs, so closures from one factory each keep their own
   * result. A callback object recorded earlier returns its stored result without
   * running again.
   */
  record<T>(callback: () => T | Promise<T>): Promise<T>;
  /**
   * Return the result recorded for a callback without invoking it. A callback
   * object the test has not recorded matches its source text only when every
   * recording with that text agrees. Otherwise this throws `CALLBACK_AMBIGUOUS`.
   */
  replay<T>(callback: () => T | Promise<T>): Promise<T>;
  /**
   * Register a reversible, versioned serializer for callback values
   * (ADR 0034). User serializers run before the built-ins, newest first, and
   * live exactly as long as this test-scoped cassette. A malformed serializer
   * throws a `CassetteError` with code `INVALID_API_USAGE`.
   */
  addSerializer<T>(serializer: CallbackSerializer<T>): void;
  mode: VcrMode;
  setMode(mode: VcrMode): void;
  redactHeader(name: string): void;
  entries: CassetteEntry[];
  /**
   * The conventional cassette path for the current test:
   * `__cassettes__/<test-name>.json` next to the test file. Useful for
   * debugging and tooling; `save()`/`load()` still accept explicit paths.
   */
  path: string;
  save(filePath: string): void;
  load(filePath: string): void;
}

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
]);

function normalizeHeaders(
  headers: any,
  redacted: Set<string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headers) return result;
  const h = new Headers(headers);
  h.forEach((val, key) => {
    const lower = key.toLowerCase();
    result[lower] = redacted.has(lower) ? "[REDACTED]" : val;
  });
  return result;
}

/** A callback's source text. Reading it never executes the callback. */
function sourceOf(callback: (...args: never[]) => unknown): string {
  return Function.prototype.toString.call(callback);
}

/** A short label for a source text, for diagnostics only. It is never a lookup key. */
function sourceLabel(source: string): string {
  return `${fnv1a(source)}:${source.length}`;
}

/** A callback recording as the sidecar stores it (ADR 0035, D1). */
interface PersistedRecording {
  source: string;
  sourceLabel: string;
  closures: number;
  encoded: string;
}

/** Version of the sidecar envelope. Changing the shape bumps this (ADR 0035). */
const SIDECAR_FORMAT = 1;

/** `<test>.callbacks.json` beside `<test>.json` (ADR 0035, D1). */
function callbacksPathFor(cassettePath: string): string {
  return cassettePath.replace(/\.json$/, ".callbacks.json");
}

/**
 * Writes through a temp file and a rename, so an interrupted write never leaves
 * a half-written cassette or sidecar behind (ADR 0035, D1).
 */
function writeAtomic(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, text, "utf8");
  renameSync(temp, path);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads the sidecar for replay. A missing file means no recordings. A file that
 * does not parse, or does not match format 1, is refused and never skipped, so
 * a broken recording cannot pass for a missing one (ADR 0035, D2).
 */
function loadSidecar(path: string): PersistedRecording[] {
  if (!existsSync(path)) return [];
  const remedy = "Delete it and re-record with VCR_MODE=record.";
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (cause) {
    throw new CassetteError(
      "CALLBACK_STORE_INVALID",
      `[bun-test-utils/vcr] Callback store ${path} is not valid JSON. ${remedy}`,
      { path },
      cause,
    );
  }
  if (
    !isRecord(parsed) ||
    parsed.format !== SIDECAR_FORMAT ||
    !Array.isArray(parsed.recordings)
  ) {
    throw new CassetteError(
      "CALLBACK_STORE_INVALID",
      `[bun-test-utils/vcr] Callback store ${path} is not a format ${SIDECAR_FORMAT} sidecar. ${remedy}`,
      { path },
    );
  }
  return parsed.recordings.map((entry: unknown, index: number) => {
    if (
      !isRecord(entry) ||
      typeof entry.source !== "string" ||
      typeof entry.sourceLabel !== "string" ||
      typeof entry.closures !== "number" ||
      !Number.isInteger(entry.closures) ||
      entry.closures < 1 ||
      typeof entry.encoded !== "string"
    ) {
      throw new CassetteError(
        "CALLBACK_STORE_INVALID",
        `[bun-test-utils/vcr] Callback store ${path} has a malformed recording at index ${index}. ${remedy}`,
        { path, index },
      );
    }
    return {
      source: entry.source,
      sourceLabel: entry.sourceLabel,
      closures: entry.closures,
      encoded: entry.encoded,
    };
  });
}

/** Record mode writes this run's recordings. No recordings removes a stale file. */
function writeSidecar(path: string, recordings: PersistedRecording[]): void {
  if (recordings.length === 0) {
    if (existsSync(path)) unlinkSync(path);
    return;
  }
  writeAtomic(
    path,
    JSON.stringify({ format: SIDECAR_FORMAT, recordings }, null, 2),
  );
}

/**
 * The callback results one test records (ADR 0027), plus the ones an earlier
 * run persisted (ADR 0035). A callback object the test has recorded is
 * identified by that object. An unrecorded object is matched by its source
 * text, and only when every matching recording holds the same result. A source
 * text that an earlier run recorded from more than one closure is refused,
 * because a closure's captured values cannot be told apart across runs.
 *
 * Values are stored as encoded text from the serializer codec (ADR 0034):
 * plain data encodes exactly as before, serializer-backed values round-trip
 * through `__bunTestUtils` envelopes, and anything else is refused.
 *
 * `record` never reads persisted recordings. Only `replay` does, and the
 * fixture loads them in replay mode alone.
 */
function createCallbackRegistry(
  codec: SerializerCodec,
  persisted: PersistedRecording[] = [],
  persistedPath?: string,
) {
  /** The serialized result of each recorded callback object. */
  const byObject = new WeakMap<object, string>();
  /** The serialized result of every recording, keyed by the full source text. */
  const bySource = new Map<string, string[]>();
  /** Distinct objects recorded per source text in this run: the closures count. */
  const closuresBySource = new Map<string, number>();
  /** This run's recordings in record order: the sidecar's contents. */
  const runRecordings: Array<{ source: string; encoded: string }> = [];
  /** Recordings an earlier run persisted, keyed by the full source text. */
  const persistedBySource = new Map<string, PersistedRecording[]>();
  for (const recording of persisted) {
    const list = persistedBySource.get(recording.source);
    if (list) list.push(recording);
    else persistedBySource.set(recording.source, [recording]);
  }

  return {
    async record<T>(callback: () => T | Promise<T>): Promise<T> {
      const known = byObject.get(callback);
      if (known !== undefined) return codec.decode<T>(known);

      const output = await callback();
      const serialized = codec.encode(output);
      // A concurrent record of this object may have finished first. Keep its
      // result, so the object has exactly one recording.
      const settled = byObject.get(callback);
      if (settled !== undefined) return codec.decode<T>(settled);

      byObject.set(callback, serialized);
      const source = sourceOf(callback);
      const recordings = bySource.get(source);
      if (recordings) recordings.push(serialized);
      else bySource.set(source, [serialized]);
      closuresBySource.set(source, (closuresBySource.get(source) ?? 0) + 1);
      runRecordings.push({ source, encoded: serialized });
      return output;
    },

    /** This run's recordings, in the shape the sidecar stores. */
    recordings(): PersistedRecording[] {
      return runRecordings.map(({ source, encoded }) => ({
        source,
        sourceLabel: sourceLabel(source),
        closures: closuresBySource.get(source) ?? 1,
        encoded,
      }));
    },

    async replay<T>(callback: () => T | Promise<T>): Promise<T> {
      const known = byObject.get(callback);
      if (known !== undefined) return codec.decode<T>(known);

      const source = sourceOf(callback);
      const key = sourceLabel(source);
      const earlier = persistedBySource.get(source) ?? [];
      if (earlier.some((recording) => recording.closures > 1)) {
        throw new CassetteError(
          "CALLBACK_AMBIGUOUS",
          `[bun-test-utils/vcr] ${earlier.length} recording(s) from an earlier run match this callback's source text (${key}), and they came from more than one closure. ` +
            "Replay the same function object you recorded. A new closure cannot be matched to one recording across runs.",
          { key, recordings: earlier.length, persisted: true },
        );
      }

      const candidates = [
        ...(bySource.get(source) ?? []),
        ...earlier.map((recording) => recording.encoded),
      ];
      if (candidates.length === 0) {
        const hint = persistedPath
          ? ` Earlier recordings are read from ${persistedPath}. A changed callback body has different source text, so re-record it with VCR_MODE=record.`
          : "";
        throw new CassetteError(
          "CALLBACK_NOT_RECORDED",
          `[bun-test-utils/vcr] No recorded callback output for ${key}. ` +
            "Call cassette.record(callback) before cassette.replay(callback)." +
            hint,
          persistedPath ? { key, path: persistedPath } : { key },
        );
      }
      if (candidates.some((serialized) => serialized !== candidates[0])) {
        throw new CassetteError(
          "CALLBACK_AMBIGUOUS",
          `[bun-test-utils/vcr] ${candidates.length} recordings match this callback's source text (${key}) and hold different results. ` +
            "Replay the same function object you recorded. A new closure with the same source text cannot be matched to one recording.",
          { key, recordings: candidates.length },
        );
      }
      return codec.decode<T>(candidates[0]!);
    },
  };
}

export const cassetteFixture = createFixture<CassetteHelper>({
  scope: "test",
  setup: async (use, ctx) => {
    let mode: VcrMode = (process.env.VCR_MODE as VcrMode) || "record";
    const redacted = new Set<string>(SENSITIVE_HEADERS);
    let entries: CassetteEntry[] = [];
    const codec = createSerializerCodec();
    const origFetch = globalThis.fetch;

    // Convention: `<test dir>/__cassettes__/<test name>.json` — replay
    // auto-loads it at setup, record auto-saves it at teardown.
    const cassettePath = join(
      dirname(ctx.testFile),
      "__cassettes__",
      `${slugifyFilename(ctx.testName ?? "cassette", "cassette")}.json`,
    );

    const callbacksPath = callbacksPathFor(cassettePath);
    let persisted: PersistedRecording[] = [];
    let persistedPath: string | undefined;
    if (mode === "replay") {
      if (!existsSync(cassettePath)) {
        throw new CassetteError(
          "CASSETTE_NOT_FOUND",
          `[bun-test-utils/vcr] Replay mode but no cassette at ${cassettePath}. ` +
            "Record it first with VCR_MODE=record.",
          { path: cassettePath },
        );
      }
      entries = JSON.parse(readFileSync(cassettePath, "utf8"));
      // Replay reads the sidecar at setup, so a corrupt file fails here (ADR 0035).
      persisted = loadSidecar(callbacksPath);
      persistedPath = existsSync(callbacksPath) ? callbacksPath : undefined;
    }
    const callbacks = createCallbackRegistry(codec, persisted, persistedPath);

    const helper: CassetteHelper = {
      async record<T>(callback: () => T | Promise<T>): Promise<T> {
        return callbacks.record(callback);
      },
      async replay<T>(callback: () => T | Promise<T>): Promise<T> {
        return callbacks.replay(callback);
      },
      addSerializer<T>(serializer: CallbackSerializer<T>): void {
        codec.add(serializer);
      },
      get mode() {
        return mode;
      },
      get path() {
        return cassettePath;
      },
      setMode(m: VcrMode) {
        mode = m;
      },
      redactHeader(name: string) {
        redacted.add(name.toLowerCase());
      },
      get entries() {
        return entries;
      },
      save(filePath: string) {
        writeAtomic(filePath, JSON.stringify(entries, null, 2));
      },
      load(filePath: string) {
        if (!existsSync(filePath)) {
          throw new CassetteError(
            "CASSETTE_NOT_FOUND",
            `[bun-test-utils/vcr] Cassette file not found: ${filePath}`,
            { path: filePath },
          );
        }
        entries = JSON.parse(readFileSync(filePath, "utf8"));
      },
    };

    // Override fetch
    globalThis.fetch = (async (input: any, init?: any): Promise<Response> => {
      if (mode === "passthrough") {
        return origFetch(input, init);
      }

      const req = new Request(input, init);
      const url = req.url;
      const method = req.method.toUpperCase();
      const headers = normalizeHeaders(req.headers, redacted);
      let body: string | undefined;
      if (req.body && method !== "GET" && method !== "HEAD") {
        try {
          body = await req.clone().text();
        } catch {
          body = undefined;
        }
      }

      if (mode === "replay") {
        const match = entries.find(
          (e) => e.request.method === method && e.request.url === url,
        );
        if (!match) {
          throw new CassetteError(
            "CASSETTE_MISMATCH",
            `[bun-test-utils/vcr] No matching cassette entry for ${method} ${url}`,
            { method, url },
          );
        }
        return new Response(match.response.body, {
          status: match.response.status,
          statusText: match.response.statusText,
          headers: match.response.headers,
        });
      }

      // Record mode: execute real request
      const liveRes = await origFetch(input, init);
      const clonedRes = liveRes.clone();
      const resBody = await clonedRes.text();
      const resHeaders: Record<string, string> = {};
      clonedRes.headers.forEach((v, k) => {
        resHeaders[k.toLowerCase()] = v;
      });

      entries.push({
        request: { method, url, headers, body },
        response: {
          status: clonedRes.status,
          statusText: clonedRes.statusText,
          headers: resHeaders,
          body: resBody,
        },
      });

      return liveRes;
    }) as any;

    try {
      await use(helper);
    } finally {
      globalThis.fetch = origFetch;
      if (mode === "record") {
        const recordings = callbacks.recordings();
        if (entries.length > 0 || recordings.length > 0) {
          // A run with no HTTP entries never empties an existing cassette. It
          // only creates an empty one when none exists, so replay's existence
          // guard still holds (ADR 0035, D1).
          if (entries.length > 0 || !existsSync(cassettePath)) {
            helper.save(cassettePath);
          }
          writeSidecar(callbacksPath, recordings);
        }
      }
    }
  },
});
