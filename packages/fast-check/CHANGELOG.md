# @bun-fixture/fast-check

## 0.1.0

Initial release: property-based testing with fixture injection, powered by `fast-check`.

- `test.prop` combines `fast-check` arbitraries with injected `bun-fixture` fixtures, and reports minimal counterexamples alongside the active fixture context.
- Session and file scoped fixtures are preserved across property iterations.

Known limitation: test-scoped fixtures are resolved once per property run, not recreated per iteration or shrink — the per-iteration fixture lifecycle is tracked for a follow-up release.
