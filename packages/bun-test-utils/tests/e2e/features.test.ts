/**
 * Behavioural suite entrypoint.
 *
 * Bun's test scanner only picks up `.ts` / `.js` files
 * (https://github.com/oven-sh/bun/issues/3440), so the feature files are
 * loaded from here. Steps live in `tests/steps/`.
 */
import { loadFeatures } from "@aboviq/bun-test-cucumber";

await loadFeatures("features/*.feature", `${import.meta.dir}/../..`);
