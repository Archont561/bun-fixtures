import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

/**
 * The callback results one test records (ADR 0027). A callback object the test
 * has recorded is identified by that object. An unrecorded object is matched by
 * its source text, and only when every recording with that text holds the same
 * result. Results stay in memory; the cassette file holds HTTP entries only.
 *
 * Values are stored as encoded text from the serializer codec (ADR 0034):
 * plain data encodes exactly as before, serializer-backed values round-trip
 * through `__bunTestUtils` envelopes, and anything else is refused.
 */
function createCallbackRegistry(codec: SerializerCodec) {
  /** The serialized result of each recorded callback object. */
  const byObject = new WeakMap<object, string>();
  /** The serialized result of every recording, keyed by the full source text. */
  const bySource = new Map<string, string[]>();

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
      return output;
    },

    async replay<T>(callback: () => T | Promise<T>): Promise<T> {
      const known = byObject.get(callback);
      if (known !== undefined) return codec.decode<T>(known);

      const source = sourceOf(callback);
      const key = sourceLabel(source);
      const recordings = bySource.get(source) ?? [];
      if (recordings.length === 0) {
        throw new CassetteError(
          "CALLBACK_NOT_RECORDED",
          `[bun-test-utils/vcr] No recorded callback output for ${key}. ` +
            "Call cassette.record(callback) before cassette.replay(callback).",
          { key },
        );
      }
      if (recordings.some((serialized) => serialized !== recordings[0])) {
        throw new CassetteError(
          "CALLBACK_AMBIGUOUS",
          `[bun-test-utils/vcr] ${recordings.length} recordings match this callback's source text (${key}) and hold different results. ` +
            "Replay the same function object you recorded. A new closure with the same source text cannot be matched to one recording.",
          { key, recordings: recordings.length },
        );
      }
      return codec.decode<T>(recordings[0]);
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
    const callbacks = createCallbackRegistry(codec);
    const origFetch = globalThis.fetch;

    // Convention: `<test dir>/__cassettes__/<test name>.json` — replay
    // auto-loads it at setup, record auto-saves it at teardown.
    const cassettePath = join(
      dirname(ctx.testFile),
      "__cassettes__",
      `${slugifyFilename(ctx.testName ?? "cassette", "cassette")}.json`,
    );

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
    }

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
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, JSON.stringify(entries, null, 2), "utf8");
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
      if (mode === "record" && entries.length > 0) {
        helper.save(cassettePath);
      }
    }
  },
});
