/**
 * The wrapper's cross-cutting property matrix (spec 0015, task_039).
 *
 * The capability packs property-test their own invariants in their own
 * `tests/`; what only this suite proves is that those behaviours hold through
 * the *assembled* public root — the fixture set the published package
 * composes, injected under fast-check generation. Every cell is seeded and
 * bounded so the suite stays deterministic, and every cell here is fileless:
 * the file-bearing snapshot and HTTP-cassette cells live in
 * `e2e/style-matrix.test.ts`, which runs them inside a scratch project.
 *
 * Deliberately absent: `dom × property` and `browser × property` are excluded
 * by spec 0015 (thin glue / subprocess cost), and prop-inside-BDD stays the
 * one seeded scratch-project scenario in `e2e/bdd/features/property.feature`.
 */
import { afterAll, beforeAll } from "bun:test";
import { existsSync } from "node:fs";
import { describe, expect, test } from "@archont561/bun-test-utils";
import { textFileSchema } from "./shared/property-schemas.ts";

/**
 * The cassette fixture's mode is pinned at the file level: the vcr cells keep
 * every callback in memory (`passthrough`, selected again in each body), and
 * the default `auto` mode refuses to resolve without a committed cassette
 * when CI is set (ADR 0036). A CI runner's environment must not change what
 * these cells mean.
 */
const ambientVcrMode = process.env.VCR_MODE;
beforeAll(() => {
  process.env.VCR_MODE = "passthrough";
});
afterAll(() => {
  if (ambientVcrMode === undefined) delete process.env.VCR_MODE;
  else process.env.VCR_MODE = ambientVcrMode;
});

const SEED = 20261007;
const ISOLATION_RUNS = 20;
const ENV_PREFIX = "BUN_TEST_UTILS_MATRIX_";

/** Every `tmpdir` handed to the isolation cell, in sample order. */
const sampleDirs: string[] = [];

describe("style matrix: property cells over the assembled root", () => {
  test.prop(
    "std × pbt: generated paths and contents round-trip through tmpdir",
    textFileSchema,
    async ({ tmpdir }, { segments, contents }) => {
      const relPath = `${segments.join("/")}.txt`;
      tmpdir.write(relPath, contents);
      expect(tmpdir.read(relPath)).toBe(contents);
      expect(tmpdir.exists(relPath)).toBe(true);
    },
    { numRuns: 25, seed: SEED },
  );

  test.prop(
    "std × pbt: generated env values round-trip and sandbox process.env",
    (fc) => ({
      key: fc.stringMatching(/^[A-Z0-9]{1,12}$/),
      value: fc.stringMatching(/^[\x20-\x7e]{0,32}$/),
    }),
    async ({ env }, { key, value }) => {
      const name = `${ENV_PREFIX}${key}`;
      env.set(name, value);
      expect(env.get(name)).toBe(value);
      expect(process.env[name]).toBe(value);
      env.delete(name);
      expect(env.get(name)).toBeUndefined();
      expect(process.env[name]).toBeUndefined();
    },
    { numRuns: 25, seed: SEED },
  );

  test.prop(
    "vcr × pbt: generated payloads record once and replay through the root cassette",
    (fc) => ({
      // JSON has no -0 (it is written as 0), so generate only canonical JSON.
      payload: fc
        .jsonValue({ maxDepth: 3 })
        .map((value) => JSON.parse(JSON.stringify(value)) as typeof value),
    }),
    async ({ cassette }, { payload }) => {
      let calls = 0;
      const load = () => {
        calls++;
        return payload;
      };

      // Passthrough: callbacks stay in memory, so nothing is written to the source tree (ADR 0035).
      cassette.setMode("passthrough");
      expect(await cassette.record(load)).toEqual(payload);
      expect(calls).toBe(1);
      expect(await cassette.replay(load)).toEqual(
        JSON.parse(JSON.stringify(payload)),
      );
      expect(calls).toBe(1);
    },
    { numRuns: 25, seed: SEED },
  );

  test.prop(
    "std × vcr × pbt: every generated sample gets its own fixture set",
    (fc) => ({ n: fc.integer({ min: 1, max: 1_000_000 }) }),
    async ({ cassette, env, tmpdir }, { n }) => {
      sampleDirs.push(tmpdir.dir);
      env.set(`${ENV_PREFIX}N`, String(n));
      expect(env.get(`${ENV_PREFIX}N`)).toBe(String(n));

      let calls = 0;
      const load = () => {
        calls++;
        return { n };
      };
      // Passthrough: callbacks stay in memory, so nothing is written to the source tree (ADR 0035).
      cassette.setMode("passthrough");
      expect(await cassette.record(load)).toEqual({ n });
      expect(await cassette.replay(load)).toEqual({ n });
      expect(calls).toBe(1);
    },
    { numRuns: ISOLATION_RUNS, seed: SEED },
  );

  test("std × vcr × pbt: sample fixtures were distinct and torn down", () => {
    expect(sampleDirs).toHaveLength(ISOLATION_RUNS);
    expect(new Set(sampleDirs).size).toBe(ISOLATION_RUNS);
    for (const dir of sampleDirs) {
      expect(existsSync(dir)).toBe(false);
    }
  });

  test.scenario
    .prop(
      "bdd × pbt × std: generated values flow through a fluent scenario",
      textFileSchema,
    )
    .given(
      "a generated payload written to the temporary directory",
      ({ contents, segments, tmpdir }) => {
        const file = `${segments.join("/")}.txt`;
        tmpdir.write(file, contents);
        return { file };
      },
    )
    .when("the file is read back", ({ tmpdir, file }) => ({
      readBack: tmpdir.read(file),
    }))
    .then(
      "the read-back value matches the generated one",
      ({ contents, readBack, expect: scenarioExpect }) => {
        scenarioExpect(readBack).toBe(contents);
      },
    );
});
