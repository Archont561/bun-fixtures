import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findProjectRoot } from "@/root.ts";

describe("findProjectRoot (ADR 0037, rule 4)", () => {
  test("finds the nearest package.json at or above the working directory", () => {
    const root = mkdtempSync(join(tmpdir(), "cli-root-"));
    writeFileSync(join(root, "package.json"), "{}");
    const deep = join(root, "a", "b", "c");
    mkdirSync(deep, { recursive: true });
    expect(findProjectRoot(deep)).toBe(root);
  });

  test("a nested package.json scopes its own package", () => {
    const outer = mkdtempSync(join(tmpdir(), "cli-root-"));
    writeFileSync(join(outer, "package.json"), "{}");
    const inner = join(outer, "packages", "pkg", "src");
    mkdirSync(inner, { recursive: true });
    writeFileSync(join(outer, "packages", "pkg", "package.json"), "{}");
    expect(findProjectRoot(inner)).toBe(join(outer, "packages", "pkg"));
    expect(findProjectRoot(outer)).toBe(outer);
  });

  test("returns null when no package.json exists above", () => {
    // The filesystem root is the boundary: only /package.json could shadow it.
    expect(findProjectRoot("/")).toBeNull();
    const root = mkdtempSync(join(tmpdir(), "cli-root-"));
    mkdirSync(join(root, "deep", "er"), { recursive: true });
    expect(findProjectRoot(join(root, "deep", "er"))).toBeNull();
  });
});
