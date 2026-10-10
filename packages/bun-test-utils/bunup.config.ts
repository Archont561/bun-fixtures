import { createBunupConfig } from "@bun-test-utils/config/bunup";

const entries = [
  "src/plugin.ts",
  "src/cli.ts",
  "src/pbt.ts",
  "src/bdd.ts",
  "src/snap.ts",
  "src/vcr.ts",
];

const bundledWorkspaces = [
  "@bun-test-utils/cli",
  "@bun-test-utils/core",
  "@bun-test-utils/core/errors",
  "@bun-test-utils/core/fetch",
  "@bun-test-utils/core/types",
  "@bun-test-utils/std",
  "@bun-test-utils/pbt",
  "@bun-test-utils/dom",
  "@bun-test-utils/browser",
  "@bun-test-utils/server",
  "@bun-test-utils/vcr",
  "@bun-test-utils/snapshot",
  "@bun-test-utils/bdd",
];

export default createBunupConfig(entries, {
  noExternal: bundledWorkspaces,
  dts: {
    entry: entries.map((entry) => `packages/bun-test-utils/${entry}`),
    cwd: `${import.meta.dir}/../..`,
    root: `${import.meta.dir}/src`,
    inferTypes: true,
    resolve: [/^@bun-test-utils\//],
  },
});
