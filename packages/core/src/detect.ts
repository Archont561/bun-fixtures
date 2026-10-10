/**
 * Fixture auto-detection from function source text (split out of plugin.ts —
 * audit 2026-10-06, finding 3).
 */

import { META_KEYS } from "./state.ts";

// `(...args: any[]) => any` is deliberate on these two exported functions:
// source-text detection accepts every callable shape a user writes (strict
// `unknown[]` parameters would reject typed callbacks by contravariance).
// This is the one dynamic boundary; the audit's narrowed interfaces live at
// the dependency adapters.

/**
 * Auto-detection of the fixtures a function requests from its destructured
 * parameter, metadata keys excluded. Exported for companion runners
 * whose own callback signatures wrap the
 * fixture context.
 */
export function detectFixtures(
  fn: (...args: any[]) => any,
  index: number,
): string[] {
  return destructuredKeys(fn, index).filter((n) => !META_KEYS.has(n));
}

/** Extracts the identifiers of a destructured parameter: `(use, { db, api })`. */
export function destructuredKeys(
  fn: (...args: any[]) => any,
  index: number,
): string[] {
  const src = Function.prototype.toString.call(fn);
  const params = paramSource(src);
  if (params === null) return [];
  const parts = splitTopLevel(params);
  const target = parts[index];
  if (!target?.trimStart().startsWith("{")) return [];
  const body = target.trim().slice(1, target.trim().lastIndexOf("}"));
  return splitTopLevel(body)
    .map((p) => p.split(/[:=]/)[0]?.trim())
    .filter((p): p is string => Boolean(p && /^[A-Za-z_$][\w$]*$/.test(p)));
}

function paramSource(src: string): string | null {
  const arrow = src.indexOf("=>");
  const start = src.indexOf("(");
  if (start === -1) {
    // `async x => ...`
    return arrow === -1
      ? null
      : src
          .slice(0, arrow)
          .replace(/^async\s+/, "")
          .trim();
  }
  if (arrow !== -1 && arrow < start) {
    return src
      .slice(0, arrow)
      .replace(/^async\s+/, "")
      .trim();
  }
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return src.slice(start + 1, i);
    }
  }
  return null;
}

function splitTopLevel(src: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = "";
  for (const ch of src) {
    if ("([{".includes(ch)) depth++;
    else if (")]}".includes(ch)) depth--;
    if (ch === "," && depth === 0) {
      out.push(buf);
      buf = "";
    } else buf += ch;
  }
  if (buf.trim()) out.push(buf);
  return out.map((s) => s.trim()).filter(Boolean);
}
