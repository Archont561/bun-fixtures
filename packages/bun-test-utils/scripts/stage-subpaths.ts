#!/usr/bin/env bun

import { cpSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const SUBPATHS = [
  "std",
  "pbt",
  "dom",
  "browser",
  "vcr",
  "snapshot",
  "bdd",
] as const;

const packageDir = resolve(import.meta.dir, "..");
const packagesDir = resolve(packageDir, "..");

for (const subpath of SUBPATHS) {
  const source = resolve(packagesDir, subpath, "src");
  const destination = resolve(packageDir, subpath, "src");

  if (!existsSync(source)) {
    throw new Error(`Cannot stage missing workspace source: ${source}`);
  }

  rmSync(resolve(packageDir, subpath), { recursive: true, force: true });
  cpSync(source, destination, { recursive: true });
}
