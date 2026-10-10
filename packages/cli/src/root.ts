/**
 * Project-root resolution (ADR 0037, rule 4).
 *
 * With `--all`, `cache clear` scopes its scan to the nearest `package.json`
 * at or above the working directory, so a run from a subdirectory covers the
 * package that owns it. A file scope (`--file`) stays relative to the working
 * directory and does not use this.
 */

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** The nearest directory at or above `from` that holds a `package.json`, else null. */
export function findProjectRoot(from: string): string | null {
  let dir = resolve(from);
  for (;;) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
