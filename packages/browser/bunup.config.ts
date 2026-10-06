import { createBunupConfig } from "@bun-test-utils/config/bunup";

export default createBunupConfig("src/index.ts", {
  preferredTsconfig: "tsconfig.build.json",
});
