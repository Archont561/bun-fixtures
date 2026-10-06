/** Shared defaults for package-owned BDD runners. Package runners provide their own settings. */
export interface BddPreset {
  featurePattern: string;
  stepDefinitionsPattern: string;
}

export function bddPreset(packageName: string): BddPreset {
  return {
    featurePattern: `packages/${packageName}/e2e/bdd/features/*.feature`,
    // Step definitions are shared repo-wide: they exercise the public
    // `bun test` surface from scratch projects, so every package's features
    // reuse the same steps (currently owned by packages/bun-test-utils).
    stepDefinitionsPattern: "packages/*/e2e/bdd/steps/**/*.steps.ts",
  };
}
