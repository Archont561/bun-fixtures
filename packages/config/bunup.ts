import { type DefineConfigItem, defineConfig } from "bunup";

type BunupDtsOptions = Exclude<DefineConfigItem["dts"], boolean | undefined> & {
  /** Working directory used by Bunup's declaration generator. */
  cwd?: string;
  /** Source root used to preserve declaration entrypoint paths. */
  root?: string;
};

export type BunupConfigOverrides = Omit<DefineConfigItem, "entry" | "dts"> & {
  dts?: boolean | BunupDtsOptions;
};

/** Shared Bun-targeted ESM build used by every code workspace. */
export function createBunupConfig(
  entry: string | string[],
  overrides: BunupConfigOverrides = {},
): DefineConfigItem {
  return defineConfig({
    entry,
    outDir: "dist",
    sourceBase: "src",
    format: "esm",
    target: "bun",
    packages: "external",
    external: ["playwright", "happy-dom", "fast-check", "citty", "smol-toml"],
    splitting: false,
    clean: true,
    dts: { inferTypes: true },
    ...overrides,
  }) as DefineConfigItem;
}
