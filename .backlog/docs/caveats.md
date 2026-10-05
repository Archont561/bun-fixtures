# Caveats, limits, and non-goals

What `bun-fixture` deliberately does not do, and where the implementation
leaks. Moved out of the package README so that it stays about philosophy and
API.

## Non-goals

| Not supported | Why |
|---------------|-----|
| `autouse` fixtures | implicit setup is the thing this package argues against; ask for what you need |
| A `request` object | `request.param` is `ctx.param`; `request.node` has no Bun equivalent |
| Gherkin / BDD feature files | separate concern — see [`@aboviq/bun-test-cucumber`](https://www.npmjs.com/package/@aboviq/bun-test-cucumber), which this repo uses for its own behavioural suite |
| `test.each`, `test.skip/only/todo` with fixtures | use `params` for the first; the rest are unimplemented, not refused |
| Non-Bun runtimes | the package ships raw TypeScript and imports `bun:test` ([ADR 0003](./adr/0003-raw-ts-distribution.md)) |

## Known limits

**No true per-directory preloading.** Bun's test scanner is closed
([oven-sh/bun#19196](https://github.com/oven-sh/bun/issues/19196)), so
discovery is a single tree walk at startup rather than a preload per
directory. Consequence: *every* fixture file in the project is imported, even
if no test uses it. Keep them declarative — a fixture file with side effects at
module scope pays them on every run.

Skipped during the walk: `node_modules`, dot-directories, `dist`, `build`,
`out`, `coverage`, and cache directories.

**Fixture files should use `import type` for `bun-fixture`.** A runtime import
from a `fixtures.ts` back into the package creates an import cycle while
discovery is running.

**File scope closes late.** Bun has no "end of test file" hook that survives
being registered inside a `describe`, so file-scoped fixtures are torn down
when the *next* file runs its first test, and the last file's at the end of the
run ([ADR 0007](./adr/0007-file-scope-closes-on-file-switch.md)). Resource-heavy
file fixtures outlive their file by a moment.

**`use` returns a promise**, although the original spec typed it `=> void`.
A `void` return makes `await use(v)` meaningless and teardown impossible
([ADR 0006](./adr/0006-use-returns-a-promise.md)). A fixture that forgets to
await simply has no cleanup — silently.

**Dependency auto-detection reads the source of your function.** Destructured
parameters are parsed out of `Function.prototype.toString`. Wrappers, decorated
functions, and aggressive minification defeat it; `deps` / `opts.fixtures` are
the explicit escape hatch.

**`bunfig.toml` comments are lost by `init`.** The CLI round-trips the file
through `smol-toml` ([ADR 0004](./adr/0004-smol-toml-for-cli.md)); it warns when
the original had comments. Hand-edit a comment-heavy config instead.

**The preload entry needs `./`.** Bun rejects a bare
`node_modules/bun-fixture/src/plugin.ts` with `preload not found`; `init`
writes `./node_modules/bun-fixture/src/plugin.ts`.

## If Bun ships fixtures natively

The engine is a thin wrapper over `bun:test`. If `test.extend` or an equivalent
lands upstream, the intent is to re-export it and deprecate this package rather
than compete with it.
