import { existsSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";

/**
 * System-library wiring for the real-browser tests.
 *
 * Playwright's chromium and firefox link against a long tail of system shared
 * libraries (nss, nspr, gbm, gtk3, …). This repository cannot `apt-get install`
 * them — the sandbox has no sudo and no package network — so they arrive
 * through the pixi `browser` environment (`pixi.toml` →
 * `[feature.browser.dependencies]`), normally put on the loader path by
 * `scripts/browser-activate.sh` when tests run under `pixi run -e browser`.
 *
 * A plain `bun test` skips that activation, and the browser then dies before it
 * starts: `error while loading shared libraries: libnspr4.so`. The browser is a
 * *child* process, so prepending the environment's `lib/` to `LD_LIBRARY_PATH`
 * from the test process is enough for the loader to find them; the already
 * loaded bun process is unaffected by the change.
 *
 * Deliberately a no-op when the pixi environment is absent — CI installs the
 * libraries with `playwright install --with-deps` instead — and on non-Linux
 * platforms, where the loader does not consult `LD_LIBRARY_PATH`.
 */

/** Nearest ancestor holding a `.pixi` directory, or null outside a checkout. */
function pixiRoot(start: string): string | null {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, ".pixi"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Puts the pixi `browser` environment's shared libraries on the loader path for
 * browser processes spawned from this point on. Idempotent, and safe to call
 * when no environment is installed.
 */
export function usePixiBrowserLibraries(): void {
  if (process.platform !== "linux") return;

  const root = pixiRoot(import.meta.dir);
  if (!root) return;

  const lib = join(root, ".pixi", "envs", "browser", "lib");
  if (!existsSync(lib)) return;

  const current = process.env.LD_LIBRARY_PATH ?? "";
  if (current.split(delimiter).includes(lib)) return;

  process.env.LD_LIBRARY_PATH = current ? `${lib}${delimiter}${current}` : lib;
}
