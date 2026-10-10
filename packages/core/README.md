# @bun-test-utils/core

Private workspace. This is the fixture engine behind [`@archont561/bun-test-utils`](../bun-test-utils/README.md). It provides the root `test`, `describe`, and `expect` runners, the `test.extend()` chain, and the rules that govern fixtures:

- resolves each test's fixture dependencies and orders them topologically;
- enforces scope rules, so a fixture never depends on a shorter-lived one;
- builds each fixture once for its scope (`session`, `file`, or `test`);
- tears fixtures down in strict LIFO order, including when a test fails;
- reports diagnostics with stable error codes and messages.

This package is not published on its own. It is bundled into the public package, and its surface is the public API documented in the [docs site](https://archont561.github.io/bun-test-utils/reference/api/).

## Source layout

| File | Role |
| :-- | :-- |
| `src/factory.ts` | The fixture-aware `test` wrapper and `test.extend()`. |
| `src/graph.ts` | Dependency ordering and scope-rule checks. |
| `src/lifecycle.ts` | Scope caches, LIFO unwinding, and session teardown. |
| `src/state.ts` | Process-wide state shared by every loaded copy of the engine. |
| `src/scenario.ts` | The fluent `test.scenario` builder. |
| `src/detect.ts` | Reads requested fixtures from a test's destructuring pattern. |
| `src/fetch.ts` | The fetch interceptor used by `networkGuard`. |
| `src/errors.ts`, `src/types.ts` | Error classes, error codes, and public types. |
| `src/plugin.ts` | The entrypoint: the preload hook and the root exports. |

Subpath exports: `./errors`, `./fetch`, `./types`, and `./plugin`.

## Develop

```bash
cd packages/core
bun run test        # unit tests
bun run test:bdd    # behavioural (Gherkin) suite
bun run typecheck
```

Architectural decisions for the engine are recorded in [`.backlog/docs/adr`](../../.backlog/docs/adr) (for example ADR 0001 on the preload and ADR 0006 on `use`), and its behaviour is specified in [`.backlog/docs/specs/0001-fixture-engine.md`](../../.backlog/docs/specs/0001-fixture-engine.md).
