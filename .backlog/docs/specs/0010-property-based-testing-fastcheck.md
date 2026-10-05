# 0010 — Property-Based Testing Integration with fast-check

- **Status:** ready
- **Implementation:** `packages/fast-check/` or `packages/bun-fixture/src/fastcheck/`
- **Tests:** `packages/bun-fixture/tests/fastcheck.test.ts`

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
