import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

export const repoRoot = resolve(import.meta.dir, "..", "..", "..");
export const packagesRoot = resolve(repoRoot, "packages");

export const runtimePackages = [
  "bdd", "browser", "bun-test-utils", "core", "dom", "pbt", "snapshot", "std", "vcr",
] as const;

export function workspacePackages(): string[] {
  return readdirSync(packagesRoot).filter((name) =>
    existsSync(resolve(packagesRoot, name, "package.json")),
  ).sort();
}

export function hasFeatureDirectory(packageName: string): boolean {
  return existsSync(resolve(packagesRoot, packageName, "features"));
}
