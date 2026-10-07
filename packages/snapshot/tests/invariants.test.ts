/**
 * Algebraic invariants of snapshot serialization, via test.prop.
 *
 * The public seam is `snapshot.match`: serialization is not exported, so
 * idempotence and key-order stability are observed as "matching a value,
 * then matching any permutation that normalizes to the same form, does
 * not throw". Scratch `createTest` keeps `__snapshots__/` out of the tree.
 */
import { afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTest } from "@bun-test-utils/core";
import { withPropertyTesting } from "@bun-test-utils/pbt";
import snapshotFixtures, { describe, expect } from "@/index.ts";

const scratchDir = mkdtempSync(join(tmpdir(), "snapshot-prop-"));
const scratchFile = join(scratchDir, "invariants.test.ts");
afterAll(() => rmSync(scratchDir, { recursive: true, force: true }));

const { test: scratchTest } = createTest(scratchFile);
const test = withPropertyTesting(
  scratchTest.extend(snapshotFixtures),
  scratchFile,
);

/** Rotate object keys (and recurse) so insertion order differs from sorted order. */
function withRotatedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withRotatedKeys);
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value as object);
    const rotated = keys.slice(1).concat(keys.slice(0, 1));
    const out: Record<string, unknown> = {};
    for (const key of rotated) {
      out[key] = withRotatedKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

// Property iterations share the test-name snapshot file (written on
// teardown, reloaded on the next setup). Unique keys keep samples isolated.
let sample = 0;

describe("@bun-test-utils/snapshot invariants", () => {
  test.prop(
    "matching a JSON value twice is stable (serialization identity)",
    (fc) => ({
      value: fc.jsonValue({ maxDepth: 3 }),
    }),
    async ({ snapshot }, { value }) => {
      const key = `once-${++sample}`;
      snapshot.setMode("match");
      snapshot.match(value, key);
      expect(() => snapshot.match(value, key)).not.toThrow();
    },
    { numRuns: 40, seed: 20261007 },
  );

  test.prop(
    "key insertion order does not change the stored snapshot",
    (fc) => ({
      value: fc.jsonValue({ maxDepth: 3 }),
    }),
    async ({ snapshot }, { value }) => {
      const key = `keys-${++sample}`;
      snapshot.setMode("match");
      snapshot.match(value, key);
      expect(() => snapshot.match(withRotatedKeys(value), key)).not.toThrow();
      // Matching a twice-rotated copy is the public observable of
      // normalize(normalize(x)) === normalize(x): the sorted-key form is a
      // fixed point of serialization.
      expect(() =>
        snapshot.match(withRotatedKeys(withRotatedKeys(value)), key),
      ).not.toThrow();
    },
    { numRuns: 40, seed: 20261007 },
  );
});
