# bun-fixture

## 0.1.0

Initial release.

- Scoped fixture engine (session / file / test) for `bun test`, pytest-style: name-based dependency injection, cycle and scope-violation detection at registration, and guaranteed LIFO teardown.
- Parameterized fixtures expanding to the cartesian product of test cases.
- Preload autodiscovery of `fixtures.ts` / `conftest.ts` per directory with root-to-leaf merge (nearest directory wins, siblings invisible); `BUN_FIXTURE_ROOT` and `BUN_FIXTURE_NO_AUTODISCOVER` honoured.
- Public API: top-level `test` / `describe` / `expect`, and `createTest` for explicit file binding; full TypeScript types.
- CLI: `bun-fixture init` adds the `[test].preload` entry to `bunfig.toml` and scaffolds a root `fixtures.ts`.
- Ships raw TypeScript with no build step, dual-licensed MIT OR Apache-2.0.
