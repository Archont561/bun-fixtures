#!/usr/bin/env bun

import { existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { resolve } from "node:path";

const SUBPATHS = [
  "core",
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
  const stagedPackage = resolve(packageDir, subpath);
  const destination = resolve(stagedPackage, "src");

  if (!existsSync(source)) {
    throw new Error(`Cannot stage missing workspace source: ${source}`);
  }

  rmSync(stagedPackage, { recursive: true, force: true });
  mkdirSync(stagedPackage, { recursive: true });
  symlinkSync(`../../${subpath}/src`, destination, "dir");
}
