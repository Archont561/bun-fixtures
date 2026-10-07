# 0018 — Release compatibility contract

- **Status:** accepted, amended by 0020
- **Date:** 2026-10-06

> Amended by [ADR-0020](./0020-remove-parameterized-fixtures.md): the stable
> fixture engine no longer includes parameterized fixtures. `params`,
> `ctx.param`, `paramCombos`, and the `[key=value]` case-name suffixes were
> removed before the first release; everything else in this contract stands.

## Context

The first npm release assembles the fixture engine and every capability behind one
`bun-test-utils` entrypoint. That gives consumers one package, but it also puts nineteen
built-in fixture names into one flat `test.extend()` namespace and makes capabilities with
very different dependency risk look equally mature. Before `0.1.0`, the project needs to say
which behavior follows normal semantic-versioning rules, how fixture-name collisions resolve,
which human-readable errors are compatibility surfaces, and which operating systems are
supported.

The VCR implementation is broader than the contract the project is prepared to maintain.
Freezing every current helper before there is usage evidence would turn provisional matching,
redaction, and storage choices into permanent obligations.

## Decision

### Stability tiers

The fixture engine and the standard, DOM, snapshot, property-testing, and minimal VCR
capabilities are **stable**. Stable APIs follow semantic versioning: breaking changes require a
major release.

The browser capability is **experimental** because it carries the Playwright peer and the
heaviest CI path. The BDD capability is **experimental** because it rides the pre-1.0
`@aboviq/bun-test-cucumber` integration. Experimental capabilities may change in minor
versions; patch releases remain for compatible fixes.

The stable VCR contract is deliberately narrow:

- `cassette.record(callback)` records one serializable callback result;
- `cassette.replay(callback)` returns that result without executing the callback; and
- HTTP replay uses one matcher: the uppercase request method and full URL must both match
  exactly.

Matcher DSLs, configurable redaction, and cassette migration tooling are deferred. Existing
provisional helpers are not release contracts. Adding capabilities later is compatible;
removing behavior from the stable surface is breaking.

### Flat fixture namespace and collisions

The public root runner contributes these nineteen fixture keys to one flat namespace:

- standard: `clock`, `seed`, `networkGuard`, `tmpdir`, `env`, `stdio`;
- DOM: `window`, `document`, `page`;
- browser: `testServer`, `serverUrl`, `browser`, `browserContext`, `browserPage`, `webPage`,
  `httpMock`, `browserHttpMock`;
- VCR: `cassette`; and
- snapshots: `snapshot`.

`test.extend()` uses explicit, last-definition-wins composition. A consumer fixture with one of
those keys intentionally overrides the built-in fixture for that runner; a later extension
wins over an earlier extension. This is neither an error nor a warning. Dependencies continue
to resolve by key, so an override also becomes the value seen by fixtures that depend on that
key.

### Contractual human-readable errors

Machine-readable error `code` and `details` remain the preferred integration surface. Only the
following human-readable message templates are contractual:

```text
[bun-test-utils] unknown fixture "<NAME>" requested in <FILE>. Available in this explicit test.extend(...) chain: <AVAILABLE>. Compose the fixture with test.extend({ <NAME>: ... }) and import that extended test into this file.

[bun-test-utils] circular fixture dependency: <TRAIL> (<FILE>)

[bun-test-utils] fixture "<NAME>" finished without calling use(value)

[bun-test-utils] networkGuard blocked unexpected fetch: <METHOD> <URL>. Allow it explicitly with networkGuard.allow(...).
```

Placeholder values may vary; punctuation and surrounding wording are stable. Other diagnostic
wording may be improved in compatible releases without a deprecation cycle.

### Platforms

Linux and macOS are supported for `0.1.x`. Windows is post-release work: the scratch-project
harness and shared BDD presets still rely on POSIX `URL.pathname` behavior, and there is no
Windows CI lane yet.

## Consequences

**Good:** consumers can distinguish durable APIs from experiments, deliberately override
built-ins, and automate against a small explicit error contract.

**Good:** VCR can grow from a small compatibility floor without preserving every provisional
helper or file-format choice.

**Trade-off:** experimental browser and BDD users accept minor-version migration work, and
Windows users do not yet receive a support guarantee.

## Alternatives considered

- **Call every bundled capability stable:** rejected because the Playwright path and third-party
  pre-1.0 BDD bridge do not have equal compatibility risk.
- **Reject built-in fixture collisions:** rejected because existing `test.extend()` composition
  already provides a useful, explicit override mechanism for project-specific fakes.
- **Contract every current error string and VCR helper:** rejected because it freezes incidental
  wording and provisional API surface before the first release.
