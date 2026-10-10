#!/usr/bin/env bun
/**
 * Public-API surface audit (audit 2026-10-06, deferred item; task_062).
 *
 * Extracts the exported names of every public entrypoint from the built
 * `packages/bun-test-utils/dist/*.d.ts` and compares them against the
 * committed baseline in `scripts/public-api.txt`. The extracted names are
 * exactly what a consumer's compiler sees, so a rename, a removal or an
 * unintended new export shows up here before it ships.
 *
 * A deliberate API change regenerates the baseline:
 *
 *   bun run build && bun run audit:api
 *
 * and the PR is expected to say why the surface moved. The check itself never
 * edits anything.
 *
 * Usage:
 *   bun scripts/public-api.ts             # compare dist against the baseline
 *   bun scripts/public-api.ts --update    # regenerate the baseline from dist
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIST = join(import.meta.dir, "..", "packages", "bun-test-utils", "dist");
const BASELINE = join(import.meta.dir, "public-api.txt");

/** Exported names in one built declaration file, sorted, duplicates dropped. */
function exportedNames(source: string): string[] {
  const names = new Set<string>();

  // `export { A, B as C }` — possibly multi-line; the exported name is the
  // one after `as` when an alias is present.
  for (const match of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of match[1].split(",")) {
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name) names.add(name);
    }
  }

  // `export declare function|const|class|type|interface|enum|namespace X`
  // (bun's declaration emit also uses this shape for re-exports of values).
  for (const match of source.matchAll(
    /export\s+(?:declare\s+)?(?:async\s+)?(?:function|const|let|var|class|type|interface|enum|namespace)\s+([A-Za-z_$][\w$]*)/g,
  )) {
    names.add(match[1]);
  }

  return [...names].sort();
}

function surfaceFromDist(): string[] {
  let files: string[];
  try {
    files = readdirSync(DIST)
      .filter((f) => f.endsWith(".d.ts"))
      .sort();
  } catch {
    console.error(
      "error: packages/bun-test-utils/dist/ not found — run `bun run build` first.",
    );
    process.exit(1);
  }

  const lines: string[] = [];
  for (const file of files) {
    const entry = file.replace(/\.d\.ts$/, "");
    const names = exportedNames(readFileSync(join(DIST, file), "utf8"));
    lines.push(`${entry}: ${names.join(", ")}`);
  }
  return lines;
}

const surface = surfaceFromDist();

if (process.argv.includes("--update")) {
  writeFileSync(BASELINE, `${surface.join("\n")}\n`);
  console.log(`baseline written: ${BASELINE} (${surface.length} entrypoints)`);
  process.exit(0);
}

let expected: string[];
try {
  expected = readFileSync(BASELINE, "utf8").split("\n").filter(Boolean);
} catch {
  console.error(
    "error: scripts/public-api.txt missing — regenerate it with `bun run build && bun run audit:api`.",
  );
  process.exit(1);
}

const missing = expected.filter((line) => !surface.includes(line));
const added = surface.filter((line) => !expected.includes(line));

if (missing.length || added.length) {
  console.error("public API surface changed against scripts/public-api.txt:");
  for (const line of missing) console.error(`  - ${line}`);
  for (const line of added) console.error(`  + ${line}`);
  console.error(
    "\nIf the change is deliberate, regenerate the baseline " +
      "(`bun run build && bun run audit:api`) and explain the surface change in the PR.",
  );
  process.exit(1);
}

console.log(`public API unchanged (${surface.length} entrypoints)`);
