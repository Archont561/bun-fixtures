# bun-test-utils

## 0.1.0

Initial release.

- Scoped fixture engine (session / file / test) for `bun test`, pytest-style: name-based dependency injection, cycle and scope-violation detection at registration, and guaranteed LIFO teardown.
- Parameterized fixtures expanding to the cartesian product of test cases.
- Preload autodiscovery of `fixtures.ts` / `conftest.ts` per directory with root-to-leaf merge (nearest directory wins, siblings invisible); `BUN_TEST_UTILS_ROOT` and `BUN_TEST_UTILS_NO_AUTODISCOVER` honoured.
- Public API: top-level `test` / `describe` / `expect`, and `createTest` for explicit file binding; full TypeScript types.
- Iteration protocol: `test(name, fn, { iterate: true })` defers test-scoped fixtures behind `ctx.iterate(fn)` — each call builds them fresh and unwinds them LIFO, giving property-based and other companion runners a per-sample fixture lifecycle (`@bun-test-utils/pbt` is built on it).
- Tooling exports for companion runners: `detectFixtures` (fixture auto-detection through wrapper callbacks) and `callerFile` (per-call test-file detection through wrapper frames).
- CLI: `bun-test-utils init` adds the `[test].preload` entry to `bunfig.toml` and scaffolds a root `fixtures.ts`.
- Ships Bunup-built ESM and TypeScript declarations, dual-licensed MIT OR Apache-2.0.
