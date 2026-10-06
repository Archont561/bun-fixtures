import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  bddPreset,
  packageFeaturesConfig,
  runPackageFeatures,
} from "@/bdd/presets.ts";

/**
 * A runner URL shaped exactly like a real one: `packages/<pkg>/e2e/bdd/features.test.ts`
 * inside this repository, derived from this test file rather than hardcoded.
 */
function runnerUrl(packageName: string): string {
  return new URL(
    `../../../${packageName}/e2e/bdd/features.test.ts`,
    import.meta.url,
  ).href;
}

describe("@bun-test-utils/config — bddPreset", () => {
  test("scopes features to the package and keeps step discovery repo-wide", () => {
    expect(bddPreset("std")).toEqual({
      featurePattern: "packages/std/e2e/bdd/features/*.feature",
      stepDefinitionsPattern: "packages/*/e2e/bdd/steps/**/*.steps.ts",
    });
  });
});

describe("@bun-test-utils/config — packageFeaturesConfig", () => {
  test("derives the repository root from the runner's own location", () => {
    const config = packageFeaturesConfig("std", { url: runnerUrl("std") });

    expect(config.cwd).toBe(new URL("../../../../", import.meta.url).pathname);
    expect(config.featurePattern).toBe(
      "packages/std/e2e/bdd/features/*.feature",
    );
    expect(config.stepDefinitionsPattern).toBe(
      "packages/*/e2e/bdd/steps/**/*.steps.ts",
    );
  });

  test("the derived cwd and patterns resolve to real files on disk", async () => {
    const config = packageFeaturesConfig("std", { url: runnerUrl("std") });

    expect(existsSync(join(config.cwd, "bun.lock"))).toBe(true);

    const features = await Array.fromAsync(
      new Bun.Glob(config.featurePattern).scan(config.cwd),
    );
    expect(features.length).toBeGreaterThan(0);

    const steps = await Array.fromAsync(
      new Bun.Glob(config.stepDefinitionsPattern).scan(config.cwd),
    );
    expect(steps.length).toBeGreaterThan(0);
  });

  test("every package's runner resolves to the same repository root", () => {
    const roots = new Set(
      ["bdd", "browser", "bun-test-utils", "core", "dom"].map(
        (name) => packageFeaturesConfig(name, { url: runnerUrl(name) }).cwd,
      ),
    );

    expect(roots.size).toBe(1);
  });

  test("rejects a runner that is not at the layout's entrypoint path", () => {
    expect(() =>
      packageFeaturesConfig("std", {
        url: new URL("features.test.ts", import.meta.url).href,
      }),
    ).toThrow(
      /must be the file packages\/std\/e2e\/bdd\/features\.test\.ts \(ADR-0016\)/,
    );
  });

  test("rejects a package name that disagrees with the runner's path", () => {
    expect(() =>
      packageFeaturesConfig("vcr", { url: runnerUrl("std") }),
    ).toThrow(/packages\/vcr\/e2e\/bdd\/features\.test\.ts/);
  });
});

describe("@bun-test-utils/config — runPackageFeatures", () => {
  test("validates the runner's location before registering the plugin", async () => {
    expect(
      runPackageFeatures("std", {
        url: new URL("features.test.ts", import.meta.url).href,
      }),
    ).rejects.toThrow(/\(ADR-0016\)/);
  });
});
