import { plugin } from "bun";
import { bunTestCucumber, loadFeatures } from "@aboviq/bun-test-cucumber";
import { bddPreset } from "@bun-test-utils/config/bdd";

const repoRoot = new URL("../../../../", import.meta.url).pathname;
const preset = bddPreset("bdd");

await plugin(
  bunTestCucumber({
    ...preset,
    cwd: repoRoot,
  }),
);

await loadFeatures(preset.featurePattern, repoRoot);
