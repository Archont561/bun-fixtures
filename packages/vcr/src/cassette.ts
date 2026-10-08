import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  CassetteError,
  createFixture,
  fnv1a,
  slugifyFilename,
} from "@bun-test-utils/core";

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

const PLAIN_DATA_HINT =
  "Return plain data instead: null, booleans, strings, finite numbers, arrays, and plain objects.";

/** Extends a diagnostic path, quoting keys that are not plain identifiers. */
function childPath(parent: string, key: string | number): string {
  if (typeof key === "number") return `${parent}[${key}]`;
  return /^[A-Za-z_$][\w$]*$/.test(key)
    ? `${parent}.${key}`
    : `${parent}[${JSON.stringify(key)}]`;
}

/** Names a non-plain object for a diagnostic. */
function describeObject(value: object): string {
  const name = (value as { constructor?: { name?: unknown } }).constructor
    ?.name;
  return typeof name === "string" && name !== "" && name !== "Object"
    ? `an instance of ${name}`
    : "an object with a non-plain prototype";
}

/** Throws the coded refusal for a value at `path` that JSON cannot round-trip. */
function refuse(
  path: string,
  valueType: string,
  hint = PLAIN_DATA_HINT,
  details: Record<string, unknown> = {},
): never {
  const where = path === "$" ? "" : ` at ${path}`;
  throw new CassetteError(
    "CALLBACK_NOT_SERIALIZABLE",
    `[bun-test-utils/vcr] cassette callback returned ${valueType}${where}, which cannot round-trip through JSON. ${hint}`,
    { path, valueType, ...details },
  );
}

/**
 * Throws unless `value` is plain data, the only shape JSON represents exactly.
 * `ancestors` maps each object on the current path to where it was first seen,
 * so a cycle is refused where it closes. A repeated reference that is not a
 * cycle is plain data and passes.
 */
function assertPlainData(
  value: unknown,
  path: string,
  ancestors: Map<object, string>,
): void {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return;
  if (typeof value === "number") {
    if (Number.isNaN(value)) refuse(path, "NaN", "Return null instead.");
    if (!Number.isFinite(value))
      refuse(
        path,
        value > 0 ? "Infinity" : "-Infinity",
        "Return null instead.",
      );
    if (Object.is(value, -0)) refuse(path, "-0", "Return 0 instead.");
    return;
  }
  if (value === undefined)
    refuse(path, "undefined", "Remove it, or return null instead.");
  if (typeof value === "bigint") refuse(path, "a BigInt");
  if (typeof value === "function") refuse(path, "a function");
  if (typeof value === "symbol") refuse(path, "a symbol");

  const object = value as object;
  const firstSeenAt = ancestors.get(object);
  if (firstSeenAt !== undefined)
    refuse(
      path,
      "a circular structure",
      `The same object is already at ${firstSeenAt}. Return a tree without cycles.`,
      { firstSeenAt },
    );

  if (Array.isArray(object)) {
    if (Object.getPrototypeOf(object) !== Array.prototype)
      refuse(path, describeObject(object));
    // Exactly the indices and `length`: a hole or an extra property fails this.
    if (Reflect.ownKeys(object).length !== object.length + 1)
      refuse(path, "a sparse array or an array with extra properties");
    ancestors.set(object, path);
    for (let index = 0; index < object.length; index++)
      assertPlainData(object[index], childPath(path, index), ancestors);
    ancestors.delete(object);
    return;
  }

  const prototype = Object.getPrototypeOf(object);
  if (prototype !== Object.prototype && prototype !== null)
    refuse(path, describeObject(object));
  const keys = Object.keys(object);
  if (Reflect.ownKeys(object).length !== keys.length)
    refuse(path, "an object with symbol-keyed or non-enumerable properties");
  ancestors.set(object, path);
  for (const key of keys)
    assertPlainData(
      (object as Record<string, unknown>)[key],
      childPath(path, key),
      ancestors,
    );
  ancestors.delete(object);
}

function serializeOutput(value: unknown): string {
  if (value === undefined) return "__undefined__";
  assertPlainData(value, "$", new Map());
  try {
    return JSON.stringify(value);
  } catch (cause) {
    // Unreachable for plain data. Kept so an unexpected JSON failure still
    // carries the code and the prefix instead of a raw error.
    throw new CassetteError(
      "CALLBACK_NOT_SERIALIZABLE",
      `[bun-test-utils/vcr] cassette callback returned a value that cannot be serialized: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      { path: "$" },
      cause,
    );
  }
}

function deserializeOutput<T>(value: string): T {
  if (value === "__undefined__") return undefined as T;
  return JSON.parse(value) as T;
}

/**
 * The callback results one test records (ADR 0027). A callback object the test
 * has recorded is identified by that object. An unrecorded object is matched by
 * its source text, and only when every recording with that text holds the same
 * result. Results stay in memory; the cassette file holds HTTP entries only.
 */
function createCallbackRegistry() {
  /** The serialized result of each recorded callback object. */
  const byObject = new WeakMap<object, string>();
  /** The serialized result of every recording, keyed by the full source text. */
  const bySource = new Map<string, string[]>();

  return {
    async record<T>(callback: () => T | Promise<T>): Promise<T> {
      const known = byObject.get(callback);
      if (known !== undefined) return deserializeOutput<T>(known);

      const output = await callback();
      const serialized = serializeOutput(output);
      // A concurrent record of this object may have finished first. Keep its
      // result, so the object has exactly one recording.
      const settled = byObject.get(callback);
      if (settled !== undefined) return deserializeOutput<T>(settled);

      byObject.set(callback, serialized);
      const source = sourceOf(callback);
      const recordings = bySource.get(source);
      if (recordings) recordings.push(serialized);
      else bySource.set(source, [serialized]);
      return output;
    },

    async replay<T>(callback: () => T | Promise<T>): Promise<T> {
      const known = byObject.get(callback);
      if (known !== undefined) return deserializeOutput<T>(known);

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
      return deserializeOutput<T>(recordings[0]);
    },
  };
}

export const cassetteFixture = createFixture<CassetteHelper>({
  scope: "test",
  setup: async (use, ctx) => {
    let mode: VcrMode = (process.env.VCR_MODE as VcrMode) || "record";
    const redacted = new Set<string>(SENSITIVE_HEADERS);
    let entries: CassetteEntry[] = [];
    const callbacks = createCallbackRegistry();
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
