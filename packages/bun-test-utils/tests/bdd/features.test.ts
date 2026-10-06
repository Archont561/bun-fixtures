import { bunTestCucumber, loadFeatures } from "@aboviq/bun-test-cucumber";
import { bddPreset } from "@bun-test-utils/config/bdd";
import { plugin } from "bun";

const preset = bddPreset("bun-test-utils");

await plugin(
  bunTestCucumber({
    // Package-local settings remain here; the config package only supplies shared defaults.
    ...preset,
    cwd: new URL("../../../../", import.meta.url).pathname,
  }),
);

await loadFeatures(
  preset.featurePattern,
  new URL("../../../../", import.meta.url).pathname,
);
