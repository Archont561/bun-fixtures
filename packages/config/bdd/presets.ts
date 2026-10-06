/** Shared defaults for package-owned BDD runners. Package runners provide their own settings. */
export interface BddPreset {
  featurePattern: string;
  stepDefinitionsPattern: string;
}

export function bddPreset(packageName: string): BddPreset {
  return {
    featurePattern: `packages/${packageName}/e2e/bdd/features/*.feature`,
    stepDefinitionsPattern: `packages/${packageName}/e2e/bdd/steps/**/*.steps.ts`,
  };
}
