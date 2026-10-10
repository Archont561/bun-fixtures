/**
 * Callback results persist across runs (ADR 0035).
 *
 * Record mode writes this run's callback recordings to a per-test sidecar,
 * `__cassettes__/<test name>.callbacks.json`, at teardown. Replay mode reads
 * that sidecar at setup and nothing else reads it: `record` always runs an
 * unrecorded callback, so a persisted value can never answer a `record` call.
 *
 * Each "run" is simulated by seeding the files a previous run would have
 * written. The seeded sources come from `new Function`, so their text is
 * stable and a fresh closure with the same body matches them exactly.
 *
 * Writes happen during teardown, after the body returns, so assertions about
 * disk live in the next test through a module-scope breadcrumb.
 */

import { afterAll, test as bunTest } from "bun:test";
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
import { createTest, type FixtureContext } from "@bun-test-utils/core";
import { CassetteError, cassetteFixture, describe, expect } from "@/index.ts";

/** Scratch project root: the convention resolves relative to this file. */
const scratchDir = mkdtempSync(join(tmpdir(), "vcr-store-"));
const scratchFile = join(scratchDir, "store.test.ts");
afterAll(() => rmSync(scratchDir, { recursive: true, force: true }));

/** Mirrors the fixture's own slug rule, so expected paths cannot drift. */
const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "cassette";

const cassettePathFor = (testName: string) =>
  join(scratchDir, "__cassettes__", `${slugify(testName)}.json`);
const sidecarPathFor = (testName: string) =>
  join(scratchDir, "__cassettes__", `${slugify(testName)}.callbacks.json`);

const { test: scratchTest } = createTest(scratchFile);

/** Replay mode, selected declaratively, as in cassette.test.ts. */
const replayTest = scratchTest.extend({
  vcrEnv: {
    setup: async (use: (value: string) => unknown) => {
      process.env.VCR_MODE = "replay";
      try {
        await use("replay");
      } finally {
        delete process.env.VCR_MODE;
      }
    },
  },
  cassette: { ...cassetteFixture, deps: ["vcrEnv"] },
});

const recordTest = scratchTest.extend({ cassette: cassetteFixture });

/**
 * A closure whose body counts its own executions. Replay must never run it,
 * so the counter stays unset. Its source text is stable across runs.
 */
const COUNTED_BODY =
  "globalThis.__vcrRan = (globalThis.__vcrRan ?? 0) + 1; return { id: 'u1' };";
const makeCounted = () => new Function(COUNTED_BODY);
const countedSource = Function.prototype.toString.call(makeCounted());
const ranCount = () =>
  (globalThis as { __vcrRan?: number }).__vcrRan ?? undefined;

/** Sidecar text exactly as record mode writes it (format 1). */
function sidecarText(
  recordings: Array<{ source: string; closures: number; encoded: string }>,
): string {
  return JSON.stringify(
    {
      format: 1,
      recordings: recordings.map((r) => ({
        source: r.source,
        sourceLabel: "seeded",
        closures: r.closures,
        encoded: r.encoded,
      })),
    },
    null,
    2,
  );
}

function seed(path: string, text: string): void {
  mkdirSync(join(scratchDir, "__cassettes__"), { recursive: true });
  writeFileSync(path, text, "utf8");
}

const GOLDEN_NAME = "writes the sidecar golden format at teardown";
const FACTORY_RECORD_NAME = "records two closures from one factory";
const REMOVE_NAME = "a record run with no callbacks removes the sidecar";
const REFUSED_NAME = "a refused callback writes no sidecar";
const IGNORE_NAME = "record mode ignores a persisted sidecar";
const REPLAY_NAME = "replay reads the sidecar and never runs the callback";
const CHANGED_NAME = "a changed callback body is not replayed from the sidecar";
const FACTORY_REPLAY_NAME =
  "a source recorded by two closures is ambiguous across runs";

// Seeds: what a previous run would have left on disk.
seed(cassettePathFor(REMOVE_NAME), "[]");
seed(
  sidecarPathFor(REMOVE_NAME),
  sidecarText([{ source: countedSource, closures: 1, encoded: '{"id":"u1"}' }]),
);
seed(
  sidecarPathFor(IGNORE_NAME),
  sidecarText([{ source: countedSource, closures: 1, encoded: '{"id":"u1"}' }]),
);
seed(cassettePathFor(REPLAY_NAME), "[]");
seed(
  sidecarPathFor(REPLAY_NAME),
  sidecarText([{ source: countedSource, closures: 1, encoded: '{"id":"u1"}' }]),
);
seed(cassettePathFor(CHANGED_NAME), "[]");
seed(
  sidecarPathFor(CHANGED_NAME),
  sidecarText([{ source: countedSource, closures: 1, encoded: '{"id":"u1"}' }]),
);
seed(cassettePathFor(FACTORY_REPLAY_NAME), "[]");
seed(
  sidecarPathFor(FACTORY_REPLAY_NAME),
  sidecarText([
    { source: countedSource, closures: 2, encoded: '{"id":"u1"}' },
    { source: countedSource, closures: 2, encoded: '{"id":"u1"}' },
  ]),
);

/** The golden fixture is the byte-level contract for the sidecar format. */
const GOLDEN_PATH = join(
  import.meta.dir,
  "fixtures",
  "callback-sidecar.golden.json",
);

const breadcrumbs: { golden?: string; factory?: string; remove?: string } = {};

describe("callback persistence: record side (ADR 0035)", () => {
  recordTest(GOLDEN_NAME, async ({ cassette }) => {
    cassette.setMode("record");
    // The callback's source is `function anonymous(\n) {\nreturn { id: 'u1' }\n}`,
    // the golden fixture's source text.
    const golden = new Function("return { id: 'u1' }");
    expect(await cassette.record(golden)).toEqual({ id: "u1" });
    // Nothing is written before teardown.
    expect(existsSync(sidecarPathFor(GOLDEN_NAME))).toBe(false);
    breadcrumbs.golden = GOLDEN_NAME;
  });

  bunTest("the golden test's teardown wrote the sidecar byte-for-byte", () => {
    const name = breadcrumbs.golden!;
    expect(readFileSync(sidecarPathFor(name), "utf8")).toBe(
      readFileSync(GOLDEN_PATH, "utf8"),
    );
    // Callback-only run: the cassette is written as an empty array, so
    // replay mode's existence guard still holds.
    expect(readFileSync(cassettePathFor(name), "utf8")).toBe("[]");
  });

  recordTest(FACTORY_RECORD_NAME, async ({ cassette }) => {
    cassette.setMode("record");
    const makeTagged = (tag: string) => () => ({ tag });
    expect(await cassette.record(makeTagged("a"))).toEqual({ tag: "a" });
    expect(await cassette.record(makeTagged("b"))).toEqual({ tag: "b" });
    breadcrumbs.factory = FACTORY_RECORD_NAME;
  });

  bunTest(
    "a factory's two recordings share one source with closures = 2",
    () => {
      const sidecar = JSON.parse(
        readFileSync(sidecarPathFor(breadcrumbs.factory!), "utf8"),
      ) as { format: number; recordings: Array<Record<string, unknown>> };
      expect(sidecar.format).toBe(1);
      expect(sidecar.recordings).toHaveLength(2);
      expect(sidecar.recordings[0]!.source).toBe(sidecar.recordings[1]!.source);
      expect(sidecar.recordings.map((r) => r.closures)).toEqual([2, 2]);
      expect(sidecar.recordings.map((r) => r.encoded)).toEqual([
        '{"tag":"a"}',
        '{"tag":"b"}',
      ]);
    },
  );

  recordTest(REMOVE_NAME, async ({ cassette }) => {
    cassette.setMode("record");
    // An HTTP entry makes the run write a cassette, but no callback runs, so
    // the existing sidecar must be removed.
    const origin = Bun.serve({ port: 0, fetch: () => new Response("ok") });
    try {
      await fetch(`http://localhost:${origin.port}/`);
    } finally {
      origin.stop(true);
    }
    breadcrumbs.remove = REMOVE_NAME;
  });

  bunTest("a record run with no callbacks removed the stale sidecar", () => {
    const name = breadcrumbs.remove!;
    expect(existsSync(sidecarPathFor(name))).toBe(false);
    const saved = JSON.parse(readFileSync(cassettePathFor(name), "utf8"));
    expect(saved).toHaveLength(1);
  });

  recordTest(REFUSED_NAME, async ({ cassette }) => {
    cassette.setMode("record");
    class Opaque {
      value = 1;
    }
    let refusal: unknown;
    try {
      await cassette.record(() => new Opaque());
    } catch (caught) {
      refusal = caught;
    }
    expect(refusal).toBeInstanceOf(CassetteError);
    expect((refusal as CassetteError).code).toBe("CALLBACK_NOT_SERIALIZABLE");
  });

  bunTest("the refused callback left neither a sidecar nor a cassette", () => {
    expect(existsSync(sidecarPathFor(REFUSED_NAME))).toBe(false);
    expect(existsSync(cassettePathFor(REFUSED_NAME))).toBe(false);
  });

  recordTest(IGNORE_NAME, async ({ cassette }) => {
    cassette.setMode("record");
    // The seeded sidecar holds this exact source, but record mode never
    // reads it, so replay must report the callback as not recorded.
    let caught: unknown;
    try {
      await cassette.replay(makeCounted());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(CassetteError);
    expect((caught as CassetteError).code).toBe("CALLBACK_NOT_RECORDED");
    expect(ranCount()).toBeUndefined();
  });
});

describe("callback persistence: replay side (ADR 0035)", () => {
  replayTest(REPLAY_NAME, async ({ cassette }) => {
    delete (globalThis as { __vcrRan?: number }).__vcrRan;
    expect(cassette.mode).toBe("replay");
    // A fresh closure with the recorded source gets the persisted result.
    expect(await cassette.replay(makeCounted())).toEqual({ id: "u1" });
    // The callback body never ran.
    expect(ranCount()).toBeUndefined();
  });

  replayTest(CHANGED_NAME, async ({ cassette }) => {
    let caught: unknown;
    try {
      await cassette.replay(() => ({ id: "changed" }));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(CassetteError);
    expect((caught as CassetteError).code).toBe("CALLBACK_NOT_RECORDED");
    // The message names the sidecar, so the fix is discoverable.
    expect((caught as CassetteError).message).toContain(
      `${slugify(CHANGED_NAME)}.callbacks.json`,
    );
  });

  replayTest(FACTORY_REPLAY_NAME, async ({ cassette }) => {
    delete (globalThis as { __vcrRan?: number }).__vcrRan;
    let caught: unknown;
    try {
      await cassette.replay(makeCounted());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(CassetteError);
    expect((caught as CassetteError).code).toBe("CALLBACK_AMBIGUOUS");
    expect(ranCount()).toBeUndefined();
  });
});

/**
 * A corrupt sidecar fails at setup, the same way a missing cassette does. It
 * is never ignored, because a silent skip would hide a broken recording.
 */
describe("callback persistence: corrupt sidecar (ADR 0035)", () => {
  const cases: Array<[string, string]> = [
    ["invalid JSON", "{not json"],
    ["an unknown format", JSON.stringify({ format: 2, recordings: [] })],
    [
      "an entry without encoded text",
      JSON.stringify({
        format: 1,
        recordings: [{ source: "x", sourceLabel: "x", closures: 1 }],
      }),
    ],
  ];

  for (const [label, text] of cases) {
    bunTest(
      `replay mode refuses a sidecar with ${label} (CALLBACK_STORE_INVALID)`,
      async () => {
        const dir = mkdtempSync(join(tmpdir(), "vcr-corrupt-"));
        const name = "has a corrupt sidecar";
        const ctx: FixtureContext = {
          testFile: join(dir, "api.test.ts"),
          testName: name,
        };
        mkdirSync(join(dir, "__cassettes__"), { recursive: true });
        writeFileSync(
          join(dir, "__cassettes__", `${slugify(name)}.json`),
          "[]",
        );
        writeFileSync(
          join(dir, "__cassettes__", `${slugify(name)}.callbacks.json`),
          text,
        );

        process.env.VCR_MODE = "replay";
        let err: Error | undefined;
        try {
          await cassetteFixture.setup(async () => {}, ctx);
        } catch (caught) {
          err = caught as Error;
        } finally {
          delete process.env.VCR_MODE;
          rmSync(dir, { recursive: true, force: true });
        }

        expect(err).toBeInstanceOf(CassetteError);
        expect((err as CassetteError).code).toBe("CALLBACK_STORE_INVALID");
        expect(err?.message.startsWith("[bun-test-utils/vcr] ")).toBe(true);
      },
    );
  }
});
