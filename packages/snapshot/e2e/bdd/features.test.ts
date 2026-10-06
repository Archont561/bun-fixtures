import { runPackageFeatures } from "@bun-test-utils/config/bdd";

await runPackageFeatures("snapshot", import.meta);
