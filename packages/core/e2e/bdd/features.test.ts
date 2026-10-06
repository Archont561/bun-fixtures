import { runPackageFeatures } from "@bun-test-utils/config/bdd";

await runPackageFeatures("core", import.meta);
