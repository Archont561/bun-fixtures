# 0019 — No base-directory override for the cassette and snapshot conventions in 0.1.x

- **Status:** accepted
- **Date:** 2026-10-06

## Context

The `vcr` and `snapshot` fixtures both derive their output location from the test file:

- `__cassettes__/<slug>.json`, from `dirname(ctx.testFile)` (`packages/vcr/src/cassette.ts`)
- `__snapshots__/<slug>.snap.json`, likewise (`packages/snapshot/src/snapshot.ts`)

`vcr` has `save(path)` / `load(path)` escape hatches. `snapshot` has none — spec 0013 R4
exposes the resolved location as a **read-only** `snapshot.path`.

task_037 hit this while composing hermetic suites and worked around it with
`createTest(<scratch path>)`, so the convention resolves inside a temporary directory. That
works and is idiomatic, but `createTest` is exported from `@bun-test-utils/core`, which is a
private workspace — it is *not* on the published wrapper. The workaround therefore
demonstrates internal composition that no consumer can reproduce.

task_045 asked which of two gaps is the real one: an opt-in base-directory override, or simply
exporting `createTest` from the wrapper. Measuring both against the contracts already frozen
for 0.1.0 answers it: **neither is cheap, and nothing is asking for either yet.**

Exporting `createTest` is blocked outright by the public API spec:

> **Spec 0004 R7** — The internal core package MAY export engine helpers for private
> workspaces; those helpers MUST NOT be re-exported from the public root package.

It would also violate R2, break the `public-api.test.ts` conformance gate that pins the root
exports to exactly `{describe, expect, test}`, and reverse ADR 0012's deliberate decision that
end users see only those three names.

The `baseDir` override is not blocked, but it is badly timed. ADR 0018 declared the snapshot
and minimal-VCR capabilities **stable** for 0.1.x, and stable means semver: once `baseDir`
ships, removing it is a breaking change. Spec 0013 R4 would need amending in the same breath
that ADR 0018 froze it. And task_037 already measured the demand — the only caller would be
this repository's own test suite, which already has a working composition.

## Decision

**Ship 0.1.0 without a base-directory override, and without exporting `createTest`.** The
conventions stay derived from `dirname(ctx.testFile)`; `vcr` keeps `save()`/`load()` as its
escape hatch and `snapshot.path` stays read-only.

The item moves to the deferral roadmap with an explicit trigger: **a consumer outside this
repository needs to redirect the convention and cannot do so with `save()`/`load()` or by
choosing where the test file lives.** Until that appears, no public API is added for it.

If the trigger fires, `baseDir` — not exporting `createTest` — is the path to take. It is an
additive capability option, whereas exporting an engine helper would reverse a design
decision and widen the root surface permanently.

## Consequences

**Good**

- The stable surface frozen by ADR 0018 stays frozen through the first release; 0.1.0 ships
  the contract it promised.
- No public API is added whose only caller is the test suite that motivated it.
- Spec 0004 R7 and ADR 0012 hold without exception, so "only three names" stays literally
  true and the conformance gate keeps enforcing it.
- The deferral is recorded with a falsifiable trigger rather than left as an omission.

**Bad**

- Consumers who want cassettes or snapshots somewhere other than next to the test file have
  only the `vcr` escape hatches; `snapshot` offers no redirection at all.
- This repository keeps composing hermetic suites with `createTest`, an internal helper, so
  that pattern stays undocumented for users.
- Adding `baseDir` later in 0.1.x is additive and safe, but if it ever needs to *change*
  shape, it will be bound by the stable contract from the moment it ships.

## Alternatives considered

- **Add the `baseDir` override now:** rejected. It widens a surface ADR 0018 declared stable
  days earlier, requires amending spec 0013 R4 and spec 0012, and serves a demand that
  task_037 measured as "the test suite only".
- **Export `createTest` from the wrapper:** rejected, and the more expensive of the two
  despite being the smaller diff. Blocked by spec 0004 R7 and R2, breaks the public API
  conformance gate, and needs an ADR superseding ADR 0012.
- **Give `snapshot` a `save(path)`/`load(path)` pair mirroring `vcr`:** rejected for 0.1.0 as
  the same widening in a smaller costume; it is the natural first increment if the trigger
  fires and `baseDir` proves too broad.
- **Do nothing and leave task_045 open:** rejected. An open task with no trigger is an
  omission pretending to be a plan; the point of the parking lot is that deferrals are
  decisions.
