import { runPackageFeatures } from "@bun-test-utils/config/bdd";

await runPackageFeatures("vcr", import.meta);
