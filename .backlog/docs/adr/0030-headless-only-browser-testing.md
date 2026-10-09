# 0030 — Browser testing is headless-only, and the browser fixture is Chromium-only

- **Status:** accepted, amended by [0032](./0032-standard-playwright-install.md)
- **Date:** 2026-10-09

## Context

`@bun-test-utils/browser` launched Chromium headless; PR #41 added a headed
detour — an Xvfb server inside the pixi `browser` environment (`scripts/xvfb.sh`,
`xorg-xvfb-server`, repairs in `scripts/browser-activate.sh` for restored
bundles, and `packages/browser/tests/headed-chromium.test.ts` as proof). That
proof cost the environment five packages and two repair scripts, and the
sandbox could never verify them against a fresh conda-forge install.
Meanwhile `launchHeadlessChromium` (full-build fallback after a missing
headless shell) already covers the CI reality, where only
`chromium-headless-shell` is installed.

Spec 0011 R3 asks for a fixture across Chromium, Firefox **and** WebKit.
WebKit's stack cannot be installed on the offline sandbox at all — the pixi
`browser` environment excludes its gtk4/gstreamer dependencies on purpose (see
the dependency block comments in `pixi.toml`) — and Firefox had no install
path here.

## Decision

1. Browser tests run headless only. The headed path is retired: the Xvfb
   script and task, the `xorg-xvfb-server` dependency, the bundle repairs in
   `scripts/browser-activate.sh` (the `LD_LIBRARY_PATH` export stays while the
   pixi environment exists), and the headed test.
2. The `browser` fixture stays Chromium-only; spec 0011 R3 is narrowed to
   Chromium (task_074). Firefox is kept as a Playwright-level launch proof fed
   by the `browsers` orphan branch (task_073), not as fixture plumbing.
   WebKit remains deferred with no install path.
3. The unused dependencies this path required are pruned with per-removal
   evidence (`ldd` plus launch proofs on the pruned environment); the
   `launchHeadlessChromium` headless-shell-then-full-build fallback is kept.

## Consequences

**Good** — the pixi `browser` environment shrinks and the sandbox stops
maintaining repair scripts for a binary nothing launches; the headed/headless
split disappears from README, tasks and tooling; dependency pruning is
evidence-based, not guessed.

**Bad** — humans lose the scripted way to watch a headed Chromium render; the
spec's R3 ambition (Firefox/WebKit fixtures) is explicitly deferred rather
than met; a future headed need re-opens this ADR.

## Alternatives considered

- Keep Xvfb headed support behind the repairs: rejected — the repairs paper
  over a pixi-sandbox relocation gap (task_069/070), the fresh-install path
  was never verifiable here, and no user-facing behaviour needed headed mode.
- Add a `BUN_TEST_UTILS_BROWSER_HEADLESS=0` knob (old task_071): rejected with
  this decision — a knob to a mode nothing supports is dead API.
- Satisfy R3 by extending the fixture to Firefox/WebKit: rejected for now —
  WebKit has no installable stack here, and the maintenance cost landed on
  this repository, exactly the pattern that made headed support expensive.
