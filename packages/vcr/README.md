# @bun-test-utils/vcr

Private workspace. It provides the `cassette` fixture, bundled into [`@archont561/bun-test-utils`](../bun-test-utils/README.md). It records and replays two things:

- **Callback results.** `cassette(callback)` is the get-or-record form: it replays a result when available and records a safe local `auto` miss with a visible warning. `cassette.record(callback)` and `cassette.replay(callback)` retain explicit control. Values beyond plain data are handled by versioned serializers. Add one for a test with `cassette.addSerializer(...)`, or register one process-wide from a preload through the public `/vcr` subpath.
- **HTTP traffic.** In `auto` mode (the default), a test's requests are recorded under `__cassettes__/` on the first run and replayed afterwards with no network access. Matching is exact on the uppercase method and full URL.

```ts
import { expect, test } from "@archont561/bun-test-utils";

test("replays a user lookup", async ({ cassette }) => {
  let calls = 0;
  const loadUser = async () => ({ id: `user-${++calls}` });

  expect(await cassette(loadUser)).toEqual({ id: "user-1" });
  expect(await cassette(loadUser)).toEqual({ id: "user-1" });
  expect(calls).toBe(1);
});
```

The helper-only `@archont561/bun-test-utils/vcr` subpath exports `defineCallbackSerializer`, `registerCallbackSerializer`, `unregisterCallbackSerializer`, and the `CallbackSerializer` type. It exports no fixture. `registerCallbackSerializer(serializer)` returns that serializer and makes it available to every cassette in the process, including root plugin fixtures after a preload. `unregisterCallbackSerializer(serializer)` removes every registration of that exact object and returns `true` when it removed one or more, otherwise `false`. Fixture-local `cassette.addSerializer` remains available and wins over globals; globals then win over built-ins.

The stable contract is callable `cassette(fn)`, explicit `record`/`replay`, fixture-local and `/vcr` global serializer registration, and exact HTTP matching. In local `auto` mode only, a callable callback source miss re-records and warns; HTTP misses, explicit replay, CI, and serializer version mismatches remain errors. Matcher DSLs, configurable redaction, and migration tooling are not part of this release. The on-disk formats are not yet stable.

See the [cassette guide](https://archont561.github.io/bun-test-utils/guides/recording-http-cassettes/) for the full behaviour, and [spec 0012](../../.backlog/docs/specs/0012-http-cassette-vcr.md) for the requirements.

## Develop

```bash
cd packages/vcr
bun run test
bun run test:bdd
bun run typecheck
```
