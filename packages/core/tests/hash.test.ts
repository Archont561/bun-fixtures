import { describe, expect, fnv1a, test } from "@/plugin.ts";

const hex = (value: number) => value.toString(16).padStart(8, "0");

describe("fnv1a", () => {
  test("matches the canonical 32-bit FNV-1a test vectors", () => {
    expect(hex(fnv1a(""))).toBe("811c9dc5");
    expect(hex(fnv1a("a"))).toBe("e40c292c");
    expect(hex(fnv1a("foobar"))).toBe("bf9cf968");
  });

  test("returns an unsigned 32-bit integer", () => {
    for (const input of ["", "a", "🚀", "x".repeat(10_000)]) {
      const value = fnv1a(input);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(0xffffffff);
    }
  });

  test("hashes UTF-16 code units, so astral characters sharing a high surrogate stay distinct", () => {
    expect(fnv1a("🚀")).not.toBe(fnv1a("🚁"));
    expect(fnv1a("test 🚀")).not.toBe(fnv1a("test 🚁"));
  });

  test("is deterministic for non-ASCII input", () => {
    expect(fnv1a("café 日本語")).toBe(fnv1a("café 日本語"));
  });
});
