# @bun-test-utils/bdd

> **Internal workspace.** Bundled into the published
> [`bun-test-utils`](https://github.com/Archont561/bun-test-utils) package as the
> `bun-test-utils/bdd` subpath; never published on its own.

A narrow bridge between the fixture engine and Gherkin-style BDD runners
([ADR 0012](../../.backlog/docs/adr/0012-bdd-fixture-bridge.md)): it wires fixture
lifecycles into `Before`/`After` hooks so scenarios can ask for fixtures — without this
package ever becoming a Gherkin runner itself.

```ts
import { fixtureSteps, openFixtures } from "bun-test-utils/bdd";
```

## Exports

| Export | Role |
| --- | --- |
| `fixtureSteps(hooks, map, ctx)` | Register `Before`/`After` hooks that build the fixture map's fixtures for each scenario and tear them down afterwards |
| `openFixtures` | The engine's scoped-lifecycle opener, re-exported for custom integrations that need fixture resolution without the hook wiring |
| `BddWorld`, `BddHooks` | Minimal world/hooks shapes any compatible runner can satisfy (`Before`/`After` taking `(world) => …`) |
| `FixtureContext`, `FixtureMap` | Types, re-exported |

The behavioural suite in `packages/bun-test-utils/features/` (Gherkin scratch projects run
through [`@aboviq/bun-test-cucumber`](https://github.com/aboviq/bun-test-cucumber))
exercises this bridge against the real engine — see spec 0006 for how those scenarios are
executed.

## Further reading

- Spec: [0014 BDD fixture bridge](../../.backlog/docs/specs/0014-bdd-fixture-bridge.md)
  and [0006 behavioural test suite](../../.backlog/docs/specs/0006-behavioural-test-suite.md)
- ADR: [0012 BDD fixture bridge — narrow the Gherkin non-goal](../../.backlog/docs/adr/0012-bdd-fixture-bridge.md)
- Sources in `src/`, focused tests in `tests/`

## License

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE), same as the repository.
