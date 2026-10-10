# @bun-test-utils/bdd

Private workspace. It adds fluent, behaviour-driven scenarios to the core runner. It exports `withBDDTesting(coreTest)`, which wraps the core `test` and adds `test.scenario(...)`. The scenario API depends on the optional [`@aboviq/bun-test-cucumber`](https://www.npmjs.com/package/@aboviq/bun-test-cucumber) peer, and the workspace loads it only when a scenario runs.

This workspace is bundled into [`@archont561/bun-test-utils`](../bun-test-utils/README.md). The public pieces are:

- `test.scenario(...)` and `test.scenario.prop(...)` on the root `test`;
- the helper-only `@archont561/bun-test-utils/bdd` subpath, which exports the typed step helpers `givenStep`, `whenStep`, and `thenStep`, and the types `GivenChain`, `GivenStep`, `WhenStep`, `ThenStep`, and `ScenarioContext`. It exports no runner.

Scenarios are **experimental** and may change in a minor release.

## Behavioural suite

Feature files live in `e2e/bdd/features/*.feature`. Each package runs its own features through a one-line entrypoint, `e2e/bdd/features.test.ts`. The repository-wide gate is:

```bash
bun run test:bdd   # from the repository root
```

## Develop

```bash
cd packages/bdd
bun run test
bun run test:bdd
bun run typecheck
```

See [ADR 0012](../../.backlog/docs/adr/0012-bdd-fixture-bridge.md) for the decision to bridge Gherkin into the fixture model, and [spec 0014](../../.backlog/docs/specs/0014-bdd-fixture-bridge.md) for its required behaviour.
