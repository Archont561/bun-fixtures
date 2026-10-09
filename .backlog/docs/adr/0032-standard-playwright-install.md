# 0032 — Browser binaries come from the standard Playwright install; retire the browsers branch

- **Status:** accepted, amends [0030](./0030-headless-only-browser-testing.md), amended by [0033](./0033-browser-ci-verification.md)
- **Date:** 2026-10-09

## Context

ADR 0030 established headless-only browser testing and a Chromium-only
`browser` fixture, with Firefox kept as a Playwright-level launch proof fed
by the `browsers` orphan branch (task_073). That branch shipped sharded
tarballs of the Playwright-pinned chromium and firefox builds, restored by
`scripts/install-browsers.sh`. The shard scheme cost a manual publish of
hundreds of megabytes per revision and could never be re-provisioned from
this sandbox (cdn.playwright.dev and the branch push path are both blocked).

The standard Playwright installer (`playwright install chromium firefox`)
downloads the same revision-pinned builds into the standard global cache
(`~/.cache/ms-playwright`, honouring `PLAYWRIGHT_BROWSERS_PATH`). It is what
CI already uses, and what contributors already know. The pixi `browser`
environment supplies the system libraries (gtk3/xorg-libxi/xorg-libxrender
for Chromium; libmozgtk → libgtk-3.so.0 for Firefox), so no `--with-deps`
is needed.

## Decision

1. **Root alias.** Add `install-browsers` to root `package.json` scripts:
   `"cd packages/browser && bunx playwright install chromium firefox"`. bunx
   resolves the workspace-pinned playwright (1.63.0), so the downloaded
   revisions match what the fixture expects (chromium-1243 / firefox-1543).
   No `--with-deps`: the pixi browser environment supplies the system
   libraries (`scripts/restore.sh` + `scripts/browser-activate.sh`).

2. **Fixture pre-flight.** When both the headless-shell attempt and the
   full-build fallback fail to launch, log and throw an actionable error
   naming `bun run install-browsers`. The `launchHeadlessChromium`
   shell-then-full-build fallback is unchanged; the new error wraps the
   underlying cause and directs the user to the install command.

3. **Chromium suites go loud.** Remove the module-scope `chromiumLaunchable`
   probe and both `describe.skipIf(!chromiumLaunchable)` wrappers from
   `packages/browser/tests/playwright.test.ts`. A missing browser surfaces
   as the fixture's loud error. CI installs chromium-headless-shell, so CI
   stays green.

4. **Firefox keeps its skip.** `firefox-headless.test.ts` keeps its
   launch-probe skip: CI installs no firefox, and firefox is not added to
   CI installs without the maintainer asking. Its header comment is updated
   to cite `bun run install-browsers` instead of `scripts/install-browsers.sh`
   and the `browsers` branch.

5. **Delete the orphan-branch mechanism.** Remove `scripts/install-browsers.sh`.
   Update the `playwright-headless-shell-fallback.test.ts` header (it cited
   "the sharded tarballs on this repository's `browsers` branch"). The
   `browsers` orphan branch itself is deleted by the maintainer on GitHub
   (not part of this code change); BROWSERS.md dies with the branch.

## Consequences

**Good** — the manual shard publish is gone; CI and contributors use the
standard Playwright installer they already know; the fixture fails loudly
with an actionable message instead of skipping silently; the codebase no
longer references the retiring `browsers` branch.

**Bad** — this sandbox cannot re-provision browsers after a wipe (cdn.playwright.dev
is blocked), so browser coverage here is best-effort until egress is restored;
post-wipe the browser fixtures fail loudly by design, which is the expected
sandbox state, not a regression.

## Alternatives considered

- **Keep the shard scheme and add a headless-shell shard** (the original
  task_075 plan): rejected — the manual publish cost is not justified when
  the standard installer serves both CI and contributors, and the sandbox
  cannot push to the branch anyway.
- **Use `bun add -g playwright` and `playwright install`**: rejected —
  unpinned global installs drift from the workspace version; `bunx`
  resolves the workspace-pinned playwright (1.63.0) so the downloaded
  revisions always match what the fixture expects.
- **Add `--with-deps` to the install**: rejected — the pixi browser
  environment already supplies the system libraries, and `--with-deps`
  requires root and installs packages the pixi env already provides.
