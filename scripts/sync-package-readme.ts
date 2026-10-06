#!/usr/bin/env bun

import { copyFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
copyFileSync(
  resolve(root, "README.md"),
  resolve(root, "packages/bun-test-utils/README.md"),
);
