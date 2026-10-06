import { createBunupConfig } from "@bun-test-utils/config/bunup";

export default createBunupConfig("src/index.ts", {
  preferredTsconfig: "tsconfig.build.json",
  noExternal: ["@bun-test-utils/core"],
  dts: {
    resolve: [/^@bun-test-utils\//],
  },
});
