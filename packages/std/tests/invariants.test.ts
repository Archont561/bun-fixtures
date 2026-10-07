/**
 * Algebraic invariants of the standard fixtures, via test.prop.
 *
 * env: set/get/delete round-trips on generated keys. tmpdir: write/read
 * identity over safe relative paths, and generated escaping paths throw.
 */
import { withPropertyTesting } from "@bun-test-utils/pbt";
import { test as base, describe, expect } from "@/index.ts";

const test = withPropertyTesting(base);

const KEY = (suffix: string) => `BUN_TEST_UTILS_PBT_${suffix}`;

describe("@bun-test-utils/std env invariants", () => {
  test.prop(
    "set/get/delete round-trip over generated keys and values",
    (fc) => ({
      suffix: fc.stringMatching(/^[A-Z]{1,8}$/),
      value: fc.stringMatching(/^[a-zA-Z0-9 ._-]{0,40}$/),
    }),
    async ({ env }, { suffix, value }) => {
      const keyName = KEY(suffix as string);
      const text = value as string;
      env.set(keyName, text);
      expect(env.get(keyName)).toBe(text);
      expect(process.env[keyName]).toBe(text);
      expect(env.snapshot()[keyName]).toBe(text);

      env.delete(keyName);
      expect(env.get(keyName)).toBeUndefined();
      expect(process.env[keyName]).toBeUndefined();
    },
    { numRuns: 40, seed: 20261007 },
  );
});

describe("@bun-test-utils/std tmpdir invariants", () => {
  test.prop(
    "write/read/exists/remove round-trip over safe relative paths",
    (fc) => ({
      parts: fc.uniqueArray(fc.stringMatching(/^[a-z0-9][a-z0-9_-]{0,7}$/), {
        minLength: 1,
        maxLength: 4,
      }),
      content: fc.stringMatching(/^[a-zA-Z0-9 ._-]{0,64}$/),
    }),
    async ({ tmpdir }, { parts, content }) => {
      const relative = `${(parts as string[]).join("/")}.txt`;
      const text = content as string;
      expect(tmpdir.exists(relative)).toBe(false);
      const written = tmpdir.write(relative, text);
      expect(written).toBe(tmpdir.path(relative));
      expect(tmpdir.exists(relative)).toBe(true);
      expect(tmpdir.read(relative)).toBe(text);
      tmpdir.remove(relative);
      expect(tmpdir.exists(relative)).toBe(false);
    },
    { numRuns: 40, seed: 20261007 },
  );

  test.prop(
    "paths that escape the scratch directory throw",
    (fc) => ({
      kind: fc.constantFrom("dotdot", "absolute"),
      segment: fc.stringMatching(/^[a-z0-9]{1,8}$/),
    }),
    async ({ tmpdir }, { kind, segment }) => {
      const filename =
        kind === "dotdot" ? `../${segment as string}` : `/${segment as string}`;
      expect(() => tmpdir.path(filename)).toThrow(
        /escapes temporary directory/,
      );
      expect(() => tmpdir.write(filename, "no")).toThrow(
        /escapes temporary directory/,
      );
    },
    { numRuns: 30, seed: 20261007 },
  );
});
