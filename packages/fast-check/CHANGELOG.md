# @bun-fixture/fast-check

## 0.1.0

Initial release: property-based testing with fixture injection, powered by `fast-check`.

- `test.prop` combines `fast-check` arbitraries with injected `bun-fixture` fixtures, and reports minimal counterexamples alongside the active fixture parameters. Requested fixtures are auto-detected from the test function's destructured first parameter, or listed with `opts.fixtures`.
- Per-iteration fixture lifecycle: session and file scoped fixtures are shared across the property run, while test-scoped fixtures are rebuilt for every generated sample — and every shrink step — and torn down LIFO, with no state leaked between iterations (engine `opts.iterate` protocol, `bun-fixture >= 0.1.0`).
