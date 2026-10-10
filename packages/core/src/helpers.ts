/**
 * Caller detection and diagnostics (split out of plugin.ts — audit
 * 2026-10-06, finding 3).
 */

import { realpathSync } from "node:fs";
import { dirname, relative, sep } from "node:path";
import { state } from "./state.ts";
import type { DiagnosticEvent, DiagnosticsSink } from "./types.ts";

const SELF = import.meta.path ?? "";

/**
 * Root of the engine's own source tree. callerFile skips every frame that
 * lives under it — before the split one file did all the work, so one exact
 * skip path was enough; now the detection must jump over whichever internal
 * module (factory, lifecycle, …) happened to call it.
 */
const ENGINE_ROOTS = new Set(
  [dirname(SELF), safeRealpath(dirname(SELF))].filter(Boolean),
);

function safeRealpath(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

/**
 * Detects the nearest caller file outside this engine (and outside
 * `extraSelf`, when given) from the stack trace.
 *
 * Exported for internal companion runners: their
 * wrappers (`test.prop`, `createPropTest`) sit between the test file and the
 * engine, so they detect their caller with `callerFile(ownIndexPath)` and
 * bind a per-file runner of their own — mirroring the top-level `test`.
 */
export function callerFile(extraSelf?: string | string[]): string {
  const skip =
    extraSelf === undefined
      ? ENGINE_ROOTS
      : new Set([
          ...ENGINE_ROOTS,
          ...(Array.isArray(extraSelf) ? extraSelf : [extraSelf]),
        ]);
  const stack = new Error().stack ?? "";
  const re = /((?:\/|[A-Za-z]:\\)[^\s()]+?\.(?:[cm]?[tj]sx?)):\d+(?::\d+)?/g;
  const installedPackage = `${sep}node_modules${sep}@archont561${sep}bun-test-utils${sep}`;
  for (const match of stack.matchAll(re)) {
    const file = match[1]!;
    if (isEngineFrame(file, skip)) continue;
    if (file.includes(installedPackage)) continue;
    if (file.startsWith("bun:") || file.includes("node:internal")) continue;
    return file;
  }
  return SELF;
}

function isEngineFrame(file: string, skip: Set<string>): boolean {
  for (const root of skip) {
    if (file === root || file.startsWith(`${root}${sep}`)) return true;
  }
  return false;
}

export function rel(p: string): string {
  const r = relative(process.cwd(), p);
  return r.startsWith("..") ? p : r || p;
}

/**
 * Installs an optional diagnostics sink and returns a restore function.
 * The engine is silent unless a sink is installed or debug mode is enabled.
 */
export function configureDiagnostics(sink?: DiagnosticsSink): () => void {
  const previous = state.diagnostics;
  state.diagnostics = sink;
  return () => {
    state.diagnostics = previous;
  };
}

/** Emits a structured diagnostic for integrations that wrap the engine. */
export function reportDiagnostic(event: DiagnosticEvent): void {
  if (state.diagnostics) {
    state.diagnostics(event);
    return;
  }
  if (process.env.BUN_TEST_UTILS_DEBUG === "1") {
    process.stderr.write(
      `[bun-test-utils] ${event.code}: ${event.message}${event.details ? ` ${JSON.stringify(event.details)}` : ""}\n`,
    );
  }
}

export function warn(
  message: string,
  code: DiagnosticEvent["code"] = "FIXTURE_COMPOSITION",
  details?: Record<string, unknown>,
): void {
  reportDiagnostic({ code, message, details });
}
