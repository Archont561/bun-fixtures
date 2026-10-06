import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { FixtureDef } from "@bun-test-utils/core";

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

/** Turns a test name into a stable, filesystem-safe cassette filename base. */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "cassette"
  );
}

export const cassetteFixture: FixtureDef<CassetteHelper> = {
  scope: "test",
  setup: async (use, ctx) => {
    let mode: VcrMode = (process.env.VCR_MODE as VcrMode) || "record";
    const redacted = new Set<string>(SENSITIVE_HEADERS);
    let entries: CassetteEntry[] = [];
    const origFetch = globalThis.fetch;

    // Convention: `<test dir>/__cassettes__/<test name>.json` — replay
    // auto-loads it at setup, record auto-saves it at teardown.
    const cassettePath = join(
      dirname(ctx.testFile),
      "__cassettes__",
      `${slugify(ctx.testName ?? "cassette")}.json`,
    );

    if (mode === "replay") {
      if (!existsSync(cassettePath)) {
        throw new Error(
          `[bun-test-utils/vcr] Replay mode but no cassette at ${cassettePath}. ` +
            "Record it first with VCR_MODE=record.",
        );
      }
      entries = JSON.parse(readFileSync(cassettePath, "utf8"));
    }

    const helper: CassetteHelper = {
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
          throw new Error(
            `[bun-test-utils/vcr] Cassette file not found: ${filePath}`,
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
          throw new Error(
            `[bun-test-utils/vcr] No matching cassette entry for ${method} ${url}`,
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
};
