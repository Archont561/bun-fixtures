import { runPackageFeatures } from "@bun-test-utils/config/bdd";

await runPackageFeatures("server", import.meta);
