#!/usr/bin/env bun
/**
 * Sandbox-only browser install (task_084). Not a replacement for
 * `bun run install-browsers`, which stays the supported installer and the one
 * CI uses (ADR 0032, ADR 0033).
 *
 * `cdn.playwright.dev` is blocked in the agent sandbox, so the standard
 * installer cannot fetch the revision-pinned Chromium. This command takes the
 * same Chromium build from npm instead:
 *
 *   1. `npm i -g @sparticuz/chromium@<pinned>` — a real global package.
 *   2. Unpack its bundled Chromium and runtime libraries with the package's own
 *      `inflate` helper, which writes under os.tmpdir() (`/tmp`).
 *   3. Write a wrapper that sets LD_LIBRARY_PATH and FONTCONFIG_PATH, and link
 *      it into the Playwright cache at the revisions the workspace pins.
 *   4. Smoke-test a headless launch through the standard Playwright API.
 *
 * Limits: the package is built for Lambda and ships Chrome Headless Shell
 * semantics, so both Playwright slots point at the same binary. Firefox is not
 * installed. `--no-shell` proves nothing here — do not use this path for CI.
 */

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Exact version: Chrome 153 matches Playwright 1.63's pinned chromium (revision 1243). */
export const SPARTICUZ_VERSION = "153.0.0";

const ROOT = resolve(import.meta.dir, "..");
const BROWSER_PKG = join(ROOT, "packages", "browser", "package.json");

/** Playwright's cache root: `PLAYWRIGHT_BROWSERS_PATH`, else the standard global cache. */
export function browserCacheRoot(
  env: Record<string, string | undefined> = process.env,
): string {
  return (
    env.PLAYWRIGHT_BROWSERS_PATH ?? join(homedir(), ".cache", "ms-playwright")
  );
}

/** Where Playwright looks for each browser, given the pinned revision of each. */
export function playwrightLayout(
  revisions: Record<string, string>,
): { dir: string; binary: string }[] {
  return [
    {
      dir: `chromium_headless_shell-${revisions["chromium-headless-shell"]}`,
      binary: "chrome-headless-shell-linux64/chrome-headless-shell",
    },
    { dir: `chromium-${revisions.chromium}`, binary: "chrome-linux64/chrome" },
  ];
}

/** Revisions Playwright pins for chromium and chromium-headless-shell, read from the workspace install. */
export function pinnedRevisions(): Record<string, string> {
  // playwright-core is a dependency of playwright, not of the workspace, so resolve it from there.
  const playwrightDir = dirname(
    createRequire(BROWSER_PKG).resolve("playwright/package.json"),
  );
  const coreDir = dirname(
    createRequire(join(playwrightDir, "package.json")).resolve(
      "playwright-core/package.json",
    ),
  );
  const { browsers } = JSON.parse(
    readFileSync(join(coreDir, "browsers.json"), "utf8"),
  ) as {
    browsers: { name: string; revision: string }[];
  };
  const pick = (name: string): string => {
    const found = browsers.find((b) => b.name === name);
    if (!found) throw new Error(`browsers.json has no entry for ${name}`);
    return found.revision;
  };
  return {
    chromium: pick("chromium"),
    "chromium-headless-shell": pick("chromium-headless-shell"),
  };
}

/** POSIX single-quote escaping, so no path can break out of the wrapper. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/** The wrapper Playwright executes in place of chrome: library and font paths, then the binary. */
export function wrapperScript(
  binary: string,
  libDir: string,
  fontDir: string,
): string {
  return [
    "#!/bin/sh",
    `export LD_LIBRARY_PATH=${shellQuote(libDir)}\${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}`,
    `export FONTCONFIG_PATH=${shellQuote(fontDir)}`,
    `exec ${shellQuote(binary)} "$@"`,
    "",
  ].join("\n");
}

function run(cmd: string[]): void {
  const result = Bun.spawnSync(cmd, {
    stdio: ["ignore", "inherit", "inherit"],
  });
  if (result.exitCode !== 0)
    throw new Error(`${cmd.join(" ")} failed with exit ${result.exitCode}`);
}

/** Install the pinned package globally unless the right version is already there. */
function ensureGlobalPackage(): string {
  const globalRoot = Bun.spawnSync(["npm", "root", "-g"])
    .stdout.toString()
    .trim();
  const pkgDir = join(globalRoot, "@sparticuz", "chromium");
  const installed = existsSync(join(pkgDir, "package.json"))
    ? (
        JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")) as {
          version: string;
        }
      ).version
    : undefined;
  if (installed !== SPARTICUZ_VERSION) {
    run(["npm", "i", "-g", `@sparticuz/chromium@${SPARTICUZ_VERSION}`]);
  }
  return pkgDir;
}

async function main(): Promise<void> {
  const pkgDir = ensureGlobalPackage();
  const inflate = (
    (await import(pathToFileURL(join(pkgDir, "build", "index.js")).href)) as {
      inflate: (path: string) => Promise<string>;
    }
  ).inflate;

  // `inflate` writes under os.tmpdir(): /tmp/chromium, /tmp/fonts, /tmp/al2023/lib, and the swiftshader libraries.
  const bin = join(pkgDir, "bin");
  const chromium = await inflate(join(bin, "chromium.br"));
  await inflate(join(bin, "fonts.tar.br"));
  await inflate(join(bin, "swiftshader.tar.br"));
  await inflate(join(bin, "al2023.tar.br"));

  const cache = browserCacheRoot();
  mkdirSync(cache, { recursive: true });
  const wrapper = join(cache, "sparticuz-chromium.sh");
  writeFileSync(
    wrapper,
    wrapperScript(
      chromium,
      join(tmpdir(), "al2023", "lib"),
      join(tmpdir(), "fonts"),
    ),
  );
  chmodSync(wrapper, 0o755);

  for (const { dir, binary } of playwrightLayout(pinnedRevisions())) {
    const target = join(cache, dir, binary);
    mkdirSync(dirname(target), { recursive: true });
    rmSync(target, { force: true });
    symlinkSync(wrapper, target);
    writeFileSync(join(cache, dir, "INSTALLATION_COMPLETE"), "");
    console.log(`linked ${target}`);
  }

  // Smoke test: a real launch through the workspace's Playwright.
  const playwrightPath = createRequire(BROWSER_PKG).resolve("playwright");
  const { chromium: pw } = (await import(
    pathToFileURL(playwrightPath).href
  )) as {
    chromium: {
      launch(o: object): Promise<{ version(): string; close(): Promise<void> }>;
    };
  };
  const browser = await pw.launch({ headless: true, timeout: 60_000 });
  console.log(`smoke launch ok: Chromium ${browser.version()}`);
  await browser.close();
}

if (import.meta.main) {
  await main();
}
