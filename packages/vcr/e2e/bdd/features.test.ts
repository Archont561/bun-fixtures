import { bunTestCucumber, loadFeatures } from "@aboviq/bun-test-cucumber";
import { bddPreset } from "@bun-test-utils/config/bdd";
import { plugin } from "bun";

const repoRoot = new URL("../../../../", import.meta.url).pathname;
const preset = bddPreset("vcr");

await plugin(
  bunTestCucumber({
    ...preset,
    cwd: repoRoot,
  }),
);

await loadFeatures(preset.featurePattern, repoRoot);
