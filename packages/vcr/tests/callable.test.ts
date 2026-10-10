/**
 * `cassette(fn)` is the intentional get-or-record path from ADR 0039.
 *
 * These direct fixture runs model process boundaries with a shared scratch
 * cassette directory. They pin the narrow local-auto fallback: only a missing
 * callback source may run and refresh; CI, explicit replay, and serializer
 * version failures remain strict.
 */
import { afterAll, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type FixtureContext, fnv1a } from "@bun-test-utils/core";
import {
  CassetteError,
  type CassetteHelper,
  cassetteFixture,
  defineCallbackSerializer,
  describe,
  expect,
} from "@/index.ts";

const scratchDir = mkdtempSync(join(tmpdir(), "vcr-callable-"));
const scratchFile = join(scratchDir, "callable.test.ts");
afterAll(() => rmSync(scratchDir, { recursive: true, force: true }));

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "cassette";

const cassettePathFor = (name: string) =>
  join(scratchDir, "__cassettes__", `${slugify(name)}.json`);
const sidecarPathFor = (name: string) =>
  join(scratchDir, "__cassettes__", `${slugify(name)}.callbacks.json`);
const contextFor = (name: string): FixtureContext => ({
  testFile: scratchFile,
  testName: name,
});

function seed(path: string, text: string): void {
  mkdirSync(join(scratchDir, "__cassettes__"), { recursive: true });
  writeFileSync(path, text, "utf8");
}

function sidecarText(
  recordings: Array<{ source: string; closures?: number; encoded: string }>,
): string {
  return JSON.stringify(
    {
      format: 1,
      recordings: recordings.map((recording) => ({
        source: recording.source,
        sourceLabel: `${fnv1a(recording.source)}:${recording.source.length}`,
        closures: recording.closures ?? 1,
        encoded: recording.encoded,
      })),
    },
    null,
    2,
  );
}

function setEnv(vars: Record<string, string | undefined>): () => void {
  const saved: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(vars)) {
    saved[name] = process.env[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  return () => {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
}

async function runCase(
  name: string,
  env: Record<string, string | undefined>,
  body: (cassette: CassetteHelper) => Promise<void>,
): Promise<void> {
  const restore = setEnv(env);
  try {
    await cassetteFixture.setup(body, contextFor(name));
  } finally {
    restore();
  }
}

async function captureWarnings<T>(
  fn: () => Promise<T>,
): Promise<{ value: T; warnings: string[] }> {
  const original = console.warn;
  const warnings: string[] = [];
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(" "));
  };
  try {
    return { value: await fn(), warnings };
  } finally {
    console.warn = original;
  }
}

async function captureError(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn();
  } catch (error) {
    return error;
  }
  throw new Error("Expected a callback error");
}

function callbackFrom(source: string): () => { id: string } {
  return new Function(source) as () => { id: string };
}

const AUTO = { VCR_MODE: undefined, CI: undefined };

describe("callable cassette (ADR 0039)", () => {
  test("record mode records once and preserves the object methods", async () => {
    const name = "callable record mode";
    let calls = 0;
    const load = () => {
      calls++;
      return { id: "recorded" };
    };

    await runCase(
      name,
      { VCR_MODE: "record", CI: undefined },
      async (cassette) => {
        expect(typeof cassette).toBe("function");
        expect(await cassette(load)).toEqual({ id: "recorded" });
        expect(await cassette(load)).toEqual({ id: "recorded" });
        expect(cassette.record).toBeDefined();
        expect(cassette.replay).toBeDefined();
        expect(calls).toBe(1);
      },
    );

    expect(existsSync(sidecarPathFor(name))).toBe(true);
  });

  test("uses fixture-local serializers through the callable", async () => {
    class Token {
      constructor(readonly value: string) {}
    }
    const name = "callable serializer";
    let calls = 0;
    const load = () => {
      calls++;
      return new Token("saved");
    };

    await runCase(
      name,
      { VCR_MODE: "record", CI: undefined },
      async (cassette) => {
        cassette.addSerializer(
          defineCallbackSerializer<Token>({
            name: "token",
            version: 1,
            test: (value) => value instanceof Token,
            serialize: (value) => value.value,
            deserialize: (value) => new Token(value as string),
          }),
        );
        expect(await cassette(load)).toEqual(new Token("saved"));
        expect(await cassette(load)).toEqual(new Token("saved"));
        expect(calls).toBe(1);
      },
    );
  });

  test("auto replays a persisted callable hit without running the callback", async () => {
    const name = "callable auto hit";
    const source =
      "globalThis.__callableRuns = (globalThis.__callableRuns ?? 0) + 1; return { id: 'hit' };";

    await runCase(
      name,
      { VCR_MODE: "record", CI: undefined },
      async (cassette) => {
        expect(await cassette(callbackFrom(source))).toEqual({ id: "hit" });
      },
    );

    delete (globalThis as { __callableRuns?: number }).__callableRuns;
    await runCase(name, AUTO, async (cassette) => {
      expect(cassette.mode).toBe("replay");
      expect(await cassette(callbackFrom(source))).toEqual({ id: "hit" });
      expect(
        (globalThis as { __callableRuns?: number }).__callableRuns,
      ).toBeUndefined();
    });
  });

  test("a local auto miss records, replaces stale source entries, and warns", async () => {
    const name = "callable edited body";
    const oldSource = "return { id: 'before-edit' };";
    const editedSource = "return { id: 'after-edit' };";
    const sidecarPath = sidecarPathFor(name);
    seed(cassettePathFor(name), "[]");
    seed(
      sidecarPath,
      sidecarText([
        {
          source: Function.prototype.toString.call(callbackFrom(oldSource)),
          encoded: '{"id":"before-edit"}',
        },
      ]),
    );

    const { warnings } = await captureWarnings(() =>
      runCase(name, AUTO, async (cassette) => {
        expect(cassette.mode).toBe("replay");
        expect(await cassette(callbackFrom(editedSource))).toEqual({
          id: "after-edit",
        });
      }),
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(
      "[bun-test-utils/vcr] cassette(fn) re-recorded callback",
    );
    expect(warnings[0]).toContain(sidecarPath);
    const saved = JSON.parse(readFileSync(sidecarPath, "utf8")) as {
      recordings: Array<{ source: string; encoded: string }>;
    };
    expect(saved.recordings).toHaveLength(1);
    expect(saved.recordings[0]!.source).toBe(
      Function.prototype.toString.call(callbackFrom(editedSource)),
    );
    expect(saved.recordings[0]!.encoded).toBe('{"id":"after-edit"}');

    // The next strict replay can consume the replacement without a cache clear.
    await runCase(
      name,
      { VCR_MODE: "replay", CI: undefined },
      async (cassette) => {
        expect(await cassette(callbackFrom(editedSource))).toEqual({
          id: "after-edit",
        });
      },
    );
  });

  test("explicit replay keeps a callable miss strict", async () => {
    const name = "callable explicit replay miss";
    seed(cassettePathFor(name), "[]");
    let calls = 0;
    const load = () => {
      calls++;
      return { id: "live" };
    };

    await runCase(
      name,
      { VCR_MODE: "replay", CI: undefined },
      async (cassette) => {
        const error = await captureError(() => cassette(load));
        expect(error).toBeInstanceOf(CassetteError);
        expect((error as CassetteError).code).toBe("CALLBACK_NOT_RECORDED");
        expect(calls).toBe(0);
      },
    );
  });

  test("CI rejects a callable auto miss without running or warning", async () => {
    const name = "callable ci miss";
    seed(cassettePathFor(name), "[]");
    let calls = 0;
    const load = () => {
      calls++;
      return { id: "must-not-run" };
    };

    const { warnings } = await captureWarnings(() =>
      runCase(name, { VCR_MODE: undefined, CI: "true" }, async (cassette) => {
        const error = await captureError(() => cassette(load));
        expect(error).toBeInstanceOf(CassetteError);
        expect((error as CassetteError).code).toBe("CALLBACK_NOT_RECORDED");
        expect(calls).toBe(0);
      }),
    );

    expect(warnings).toEqual([]);
    expect(existsSync(sidecarPathFor(name))).toBe(false);
  });

  test("a serializer version mismatch remains an error in local auto mode", async () => {
    const name = "callable serializer version mismatch";
    const source =
      "globalThis.__callableSerializerRan = (globalThis.__callableSerializerRan ?? 0) + 1; return { id: 'live' };";
    const callback = callbackFrom(source);
    const sidecarPath = sidecarPathFor(name);
    seed(cassettePathFor(name), "[]");
    seed(
      sidecarPath,
      sidecarText([
        {
          source: Function.prototype.toString.call(callback),
          encoded:
            '{"__bunTestUtils":{"name":"token","version":1,"data":{"value":"stored"}}}',
        },
      ]),
    );
    delete (globalThis as { __callableSerializerRan?: number })
      .__callableSerializerRan;
    const before = readFileSync(sidecarPath, "utf8");

    const { warnings } = await captureWarnings(() =>
      runCase(name, AUTO, async (cassette) => {
        cassette.addSerializer(
          defineCallbackSerializer({
            name: "token",
            version: 2,
            test: () => false,
            serialize: () => ({}),
            deserialize: () => ({ value: "v2" }),
          }),
        );
        const error = await captureError(() => cassette(callback));
        expect(error).toBeInstanceOf(CassetteError);
        expect((error as CassetteError).code).toBe(
          "CALLBACK_SERIALIZER_NOT_FOUND",
        );
      }),
    );

    expect(warnings).toEqual([]);
    expect(
      (globalThis as { __callableSerializerRan?: number })
        .__callableSerializerRan,
    ).toBeUndefined();
    expect(readFileSync(sidecarPath, "utf8")).toBe(before);
  });
});
