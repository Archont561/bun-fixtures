# 0015 — Per-package READMEs with a concise canonical root

- **Status:** accepted
- **Date:** 2026-10-06

## Context

The publication audit (task_016, 2026-10-05) removed all private package READMEs in favour
of one consolidated root README with a section per capability, and `scripts/sync-package-readme.ts`
copies that root file into the published package. After living with that shape, the
maintainer direction changed (2026-10-06): the 500-line monolith mixes storefront,
deep-dive, and maintainers' notes, while each capability pack has no home for its own
install notes, peer-dependency caveats, and helper reference.

## Decision

Every workspace package owns a `README.md` again. The root `README.md` becomes the concise
entry point: pitch, install, quick start, public API shape, links to internal package notes, repo map, status, and development gates. Package READMEs carry maintainer-facing details — fixture/API tables, peer-dependency notes, examples, and links to specs.

The sync mechanism is removed. The wrapper owns its own README, which is packaged with the
published artifact. Package README structure is an internal concern and does not change the packaging contract
([0005](../specs/0005-packaging-and-release.md) R3): the tarball still contains exactly one
README — the wrapper's own — because the `files` allowlist is evaluated in the wrapper
directory only.

This supersedes the "one consolidated README" checklist item in task_016; the rest of that
audit stands.

## Consequences

**Good:** each capability documents itself next to its source; the root README reads in
minutes; peer-dependency caveats live beside their internal implementation; deep links
(`./packages/<name>#readme`) keep GitHub navigation one click.

**Bad:** package READMEs can drift from exports without a mechanical check; relative links
in the published README point at repository paths that do not exist on npm (accepted — the
package is unpublished, and the links are correct on GitHub, the only place they resolve
today).

## Alternatives considered

- **Keep the consolidated monolith:** zero drift risk, but the root README was already over
  500 lines while packages had no documentation home.
- **Concise root, details only on the docs site:** less duplication, but the docs site is
  not rendered beside the code in PR review and code search the way package READMEs are.
