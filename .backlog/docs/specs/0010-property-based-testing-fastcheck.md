# 0010 — Property-Based Testing Integration with fast-check

- **Status:** implemented
- **Implementation:** `packages/pbt/` (`test.prop` built on the engine's `opts.iterate` protocol in `packages/core/src/plugin.ts`)
- **Tests:** `packages/pbt/tests/index.test.ts`, `packages/pbt/tests/engine.test.ts` (cartesian `paramCombos` and topological `resolveOrder`), engine protocol in `packages/core/tests/plugin.test.ts` ("iteration protocol (opts.iterate)"). Capability-pack invariants live next to their fixtures: `packages/{vcr,snapshot,std}/tests/invariants.test.ts`.

## Problem

Parameterized fixtures in `bun-fixture` today only support static arrays expanding to Cartesian products at registration time. Complex algorithms, serializers, and state machines require property-based testing with dynamic arbitrary generators and automatic counterexample shrinking.

## Requirements

| # | Requirement |
|---|-------------|
| R1 | Expose `test.prop(title, arbitraries, testFn, options?)` combining `fast-check` Arbitraries with injected fixtures. |
| R2 | Session and file-scoped fixtures MUST remain cached and shared across the iteration run of `fc.assert`. |
| R3 | Test/iteration fixtures MUST reset or clean up between sample executions. |
| R4 | When `fast-check` fails and performs shrinking, LIFO fixture teardown MUST execute cleanly on each shrink step. |
| R5 | Failure output MUST report the minimal shrunk counterexample alongside active fixture parameters. |

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

## Verification

- Tests verifying shrinking reproducer output.
- Verification that fixture teardown hooks execute once per sample or test as configured.

## Notes on the shipped design

`prop` registers the property inside one `bun test` case declared with
`opts.iterate` (`ctx.iterate`), the engine's per-sample fixture protocol: the
wrapper test builds only session/file fixtures, and every `fc.assert` sample —
including shrink candidates — runs through `ctx.iterate`, which rebuilds the
test-scoped fixtures and unwinds them LIFO even when the predicate throws.
Requested fixtures are auto-detected from the test function's destructured
first parameter; the top-level `prop` resolves the calling test file per call
via the exported `callerFile`, exactly like the engine's top-level `test`.
