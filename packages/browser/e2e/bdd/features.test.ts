import { runPackageFeatures } from "@bun-test-utils/config/bdd";

await runPackageFeatures("browser", import.meta);
