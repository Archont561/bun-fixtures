import { createBunupConfig } from "@bun-test-utils/config/bunup";

export default createBunupConfig(
  ["src/plugin.ts", "src/cli.ts", "src/types.ts"],
  { preferredTsconfig: "tsconfig.build.json" },
);
