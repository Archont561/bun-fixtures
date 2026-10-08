# 0010 — Property-Based Testing Integration with fast-check

- **Status:** implemented
- **Implementation:** `packages/pbt/` (`test.prop` built on the engine's `opts.iterate` protocol in `packages/core/src/plugin.ts`)
- **Tests:** `packages/pbt/tests/index.test.ts`, `packages/pbt/tests/engine.test.ts` (topological `resolveOrder`), engine protocol in `packages/core/tests/plugin.test.ts` ("iteration protocol (opts.iterate)"). Capability-pack invariants live next to their fixtures: `packages/{vcr,snapshot,std}/tests/invariants.test.ts`.

## Problem

Test suites need to vary one test over many values. Static, hand-listed values
(the engine's former `params`, removed by
[ADR 0020](../adr/0020-remove-parameterized-fixtures.md)) only cover the cases
the author thought of. Complex algorithms, serializers, and state machines
require property-based testing with dynamic arbitrary generators and automatic
counterexample shrinking.

## Requirements

| # | Requirement |
|---|-------------|
| R1 | Expose `test.prop(title, arbitraries, testFn, options?)` combining `fast-check` Arbitraries with injected fixtures. |
| R2 | Session and file-scoped fixtures MUST remain cached and shared across the iteration run of `fc.assert`. |
| R3 | Test/iteration fixtures MUST reset or clean up between sample executions. |
| R4 | When `fast-check` fails and performs shrinking, LIFO fixture teardown MUST execute cleanly on each shrink step. |
| R5 | Failure output MUST report the minimal shrunk counterexample alongside the replay seed. |
| R6 | `test.prop` and `test.scenario.prop` MUST accept reusable fast-check arbitrary records or factories with typed APIs and infer generated values at the callback site; arbitrary definitions MUST compose through ordinary TypeScript operations. |
| R7 | The `bun-test-utils/pbt` helper subpath MUST export `defineArbitraries`, an identity wrapper that contextually types reusable fast-check arbitrary records/factories and preserves their types. |

## Design

```ts
test.prop(
  "encodes and decodes roundtrip cleanly",
  {
    user: fc.record({ name: fc.string(), age: fc.nat() }),
    salt: fc.hexaString({ minLength: 8 }),
  },
  async ({ db, encoder }, { user, salt }) => {
    const encoded = encoder.encode(user, salt);
    expect(encoder.decode(encoded, salt)).toEqual(user);
  },
  { numRuns: 100 }
);
```

### Reusable arbitrary definitions (task_048)

A set of arbitraries remains an ordinary record or factory that consumers can export from a shared module and explicitly import from any property test. The `bun-test-utils/pbt` `defineArbitraries` identity wrapper contextually types factory arguments as the fast-check API, preserving its arbitrary record type without requiring each definition file to import `FastCheckApi`. `ArbitraryInput<T>` describes a record or factory, and `GeneratedValues<T>` maps each fast-check arbitrary to its generated value type. Both `test.prop` and `test.scenario.prop` use the same typing, so consumers need no casts at generated-value call sites. Definitions compose with normal object spread; no registry or definition-processing runtime helper is introduced. The subpath decision is recorded in [spec 0004](./0004-public-api-and-types.md#capability-scoped-typed-helpers-adr-0022), [ADR 0022](../adr/0022-typed-helper-subpaths.md), and the naming amendment in [ADR 0023](../adr/0023-define-arbitraries-helper.md).

## Verification

- Tests verifying shrinking reproducer output.
- Verification that fixture teardown hooks execute once per sample or test as configured.
- Shared arbitrary definitions are imported from two test files, derived through object spread, and typechecked without generated-value casts; the same record type flows through `test.scenario.prop`.
- `bun-test-utils/pbt` is tested as the `defineArbitraries` identity-wrapper subpath; shared factory declarations receive contextual fast-check typing without importing `FastCheckApi`.

## Notes on the shipped design

`prop` registers the property inside one `bun test` case declared with
`opts.iterate` (`ctx.iterate`), the engine's per-sample fixture protocol: the
wrapper test builds only session/file fixtures, and every `fc.assert` sample —
including shrink candidates — runs through `ctx.iterate`, which rebuilds the
test-scoped fixtures and unwinds them LIFO even when the predicate throws.
Requested fixtures are auto-detected from the test function's destructured
first parameter; the top-level `prop` resolves the calling test file per call
via the exported `callerFile`, exactly like the engine's top-level `test`.

The optional runtime peer's declarations are present in the bundled root type
surface. An isolated strict consumer (`skipLibCheck: false`) without
`fast-check` fails while resolving the PBT declaration imports, even when its
source uses only `test` and `expect`; setting `skipLibCheck: true` lets ordinary
root imports typecheck. This is documented in the shipped README. Keep the
peer optional for runtime installs; changing the declaration dependency model
would require a separate API design review.
