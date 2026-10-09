# 0033 — CI uses the shared browser installer and verifies both Chromium launch paths

- **Status:** accepted, amends [0032](./0032-standard-playwright-install.md)
- **Date:** 2026-10-09

## Context

Task_075 established `bun run install-browsers` as the supported installation
path, but CI still installed only `chromium-headless-shell`. Task_013 therefore
lacked CI evidence for real full-build Chromium: the fallback tests use a
Playwright stub, not a browser binary. The maintainer asked to use the shared
installer in CI and finish task_013.

The root command installs Chromium (full build and headless shell) and Firefox.
Installing both Chromium builds alone does not exercise the fallback: the
fixture's first launch still selects the headless shell. Also, `--no-shell`
does not remove a shell left by a previous installation or restored cache.

## Decision

1. **Use the same installer in CI and locally.** The existing Test job runs
   `bun run install-browsers --with-deps`. Bun forwards the flag to the
   workspace-pinned Playwright CLI. GitHub's Ubuntu runner gets its system
   libraries through Playwright; the local pixi path keeps using the command
   without `--with-deps`. The root script and browser versions do not change.

2. **Verify both real Chromium paths.** The regular suite runs against the
   standard installation, including the headless shell. A separate step in
   the same job creates a fresh `PLAYWRIGHT_BROWSERS_PATH`, runs
   `bun run install-browsers --no-shell`, asserts that no headless shell was
   installed, and reruns `packages/browser/tests/playwright.test.ts` directly
   with Bun. This exercises the full-build fallback with the same session
   reuse, context/storage isolation, interaction and teardown assertions.
   The temporary cache is never restored from the normal browser cache, and
   the direct test invocation cannot reuse a Turborepo test result.

3. **Firefox's launch proof is required in CI.** Since the shared installer
   now provisions Firefox, its Playwright-level proof must fail rather than
   skip under `CI=true`. The local launch-probe skip remains for contributors
   without Firefox and for the restricted sandbox. Subprocess tests with an
   empty browser cache pin both policies. This amends ADR 0032's CI-only
   headless-shell installation and Firefox-skip decisions.

4. **No new fixture capability.** The browser fixture remains headless and
   Chromium-only. Firefox is still a Playwright-level launch proof, not a
   fixture; WebKit and headed mode remain deferred. No public exports or
   runtime behavior change.

## Consequences

**Good** — CI exercises the documented installation command, the existing
headless-shell path, the real full-build fallback, and the Firefox launch
proof. An accidentally cached shell cannot turn the fallback proof into a
second headless-shell run.

**Bad** — the isolated fallback step downloads Chromium and Firefox again.
This deliberately trades download time for a small, unambiguous check without
another CI job or a second cache policy. The sandbox's blocked Playwright CDN
is unchanged; real-browser completion evidence must come from CI or another
browser-present environment.

## Alternatives considered

- **Only switch CI to the root alias:** insufficient — the default fixture
  launch still uses the headless shell and never proves the fallback.
- **Use `--no-shell` with the existing cache:** rejected — an already cached
  shell remains usable, making the check misleading.
- **Replace the sole CI installation with a full-build-only one:** rejected —
  it drops real headless-shell coverage instead of covering both paths.
- **Add a matrix or another full-suite job:** unnecessary — the existing
  real-browser suite is the focused proof, and the same runner already has
  the system dependencies.
