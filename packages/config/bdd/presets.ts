import { fileURLToPath } from "node:url";
import { bunTestCucumber, loadFeatures } from "@aboviq/bun-test-cucumber";
import { plugin } from "bun";

/** Shared defaults for package-owned BDD runners. */
export interface BddPreset {
  featurePattern: string;
  stepDefinitionsPattern: string;
}

/** A {@link BddPreset} anchored to the repository root the patterns are relative to. */
export interface PackageFeaturesConfig extends BddPreset {
  cwd: string;
}

/**
 * The structural part of `import.meta` the helpers need. Narrower than
 * `ImportMeta` so a test can pass a synthetic runner location without a cast.
 */
export interface RunnerModule {
  url: string;
}

/** Where ADR-0016 puts a package's BDD assets, relative to the package. */
const RUNNER_DIR = "e2e/bdd";
/** The entrypoint file ADR-0016 requires, relative to the package. */
const RUNNER_ENTRYPOINT = `${RUNNER_DIR}/features.test.ts`;

export function bddPreset(packageName: string): BddPreset {
  return {
    featurePattern: `packages/${packageName}/${RUNNER_DIR}/features/*.feature`,
    // Step definitions are shared repo-wide: they exercise the public
    // `bun test` surface from scratch projects, so every package's features
    // reuse the same steps (currently owned by packages/bun-test-utils).
    stepDefinitionsPattern: "packages/*/e2e/bdd/steps/**/*.steps.ts",
  };
}

/**
 * Resolve a package's BDD configuration from the runner's own location.
 *
 * The feature and step patterns are repository-relative, so they need the
 * repository root as `cwd`. Rather than have every runner count `../` segments,
 * the root is derived from the runner's URL: the ADR-0016 entrypoint path
 * `packages/<packageName>/e2e/bdd/features.test.ts` is a known suffix, and what
 * precedes it is the repository root. A runner that sits anywhere else — or
 * that names a package other than its own directory — is a wiring mistake, and
 * fails here with the expected path instead of silently matching no features.
 */
export function packageFeaturesConfig(
  packageName: string,
  importMeta: RunnerModule,
): PackageFeaturesConfig {
  const runnerPath = fileURLToPath(importMeta.url);
  const expectedSuffix = `/packages/${packageName}/${RUNNER_ENTRYPOINT}`;

  if (!runnerPath.endsWith(expectedSuffix)) {
    throw new Error(
      `@bun-test-utils/config: the BDD runner for "${packageName}" must be the file ` +
        `packages/${packageName}/${RUNNER_ENTRYPOINT} (ADR-0016), but it was called from ${runnerPath}.`,
    );
  }

  return {
    ...bddPreset(packageName),
    // Keep the trailing separator: `cwd` names a directory.
    cwd: runnerPath.slice(0, -expectedSuffix.length + 1),
  };
}

/**
 * Run a package's BDD suite: the whole body of a `features.test.ts` entrypoint.
 *
 * ```ts
 * import { runPackageFeatures } from "@bun-test-utils/config/bdd";
 *
 * await runPackageFeatures("std", import.meta);
 * ```
 *
 * Registering the cucumber plugin and loading the feature files are one step,
 * not two: a runner that does only the first silently reports zero scenarios.
 */
export async function runPackageFeatures(
  packageName: string,
  importMeta: RunnerModule,
): Promise<void> {
  const { cwd, featurePattern, stepDefinitionsPattern } = packageFeaturesConfig(
    packageName,
    importMeta,
  );

  // The plugin only compiles `.feature` files and auto-imports step definitions;
  // `featurePattern` is not one of its options (it was silently ignored when the
  // nine hand-written runners spread the whole preset into it). Feature selection
  // belongs to `loadFeatures`, because Bun's scanner skips `.feature` files.
  await plugin(bunTestCucumber({ stepDefinitionsPattern, cwd }));
  await loadFeatures(featurePattern, cwd);
}
