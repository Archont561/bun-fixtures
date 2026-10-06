import { runPackageFeatures } from "@bun-test-utils/config/bdd";

await runPackageFeatures("dom", import.meta);
