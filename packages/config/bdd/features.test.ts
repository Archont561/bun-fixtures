/** Repo-wide Behavioural suite entrypoint.
 *
 * Bun's test scanner only picks up .ts/.js files, so package-owned
 * features/*.feature files are loaded from this shared configuration-owned test.
 * Step definitions live beside the packages they exercise and are discovered
 * from one repository-wide plugin configuration.
 */

import { describe, expect, test } from "bun:test";
import { bunTestCucumber, loadFeatures } from "@aboviq/bun-test-cucumber";
import { plugin } from "bun";
import { featureExemptions } from "./feature-exemptions";
import { hasFeatureDirectory, packagesRoot, repoRoot, runtimePackages, workspacePackages } from "@bun-test-utils/config/bdd";

await plugin(
  bunTestCucumber({
    cwd: repoRoot,
    stepDefinitionsPattern: "packages/*/tests/steps/**/*.steps.ts",
  }),
);

describe("repo-wide BDD feature coverage", () => {
  test("runtime packages own feature coverage or documented exemptions", () => {
    for (const packageName of runtimePackages) {
      expect(
        hasFeatureDirectory(packageName),
        `${packageName} is missing packages/${packageName}/features`,
      ).toBe(true);
    }

    for (const packageName of workspacePackages()) {
      const hasFeatures = hasFeatureDirectory(packageName);
      const exempt = (featureExemptions as Record<string, string>)[packageName];
      expect(
        hasFeatures || Boolean(exempt),
        `${packageName} needs features/ coverage or a documented exemption`,
      ).toBe(true);
    }
  });
});

for (const packageName of workspacePackages().filter(hasFeatureDirectory)) {
  await loadFeatures(`packages/${packageName}/features/*.feature`, repoRoot);
}
