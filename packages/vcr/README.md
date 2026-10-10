# @bun-test-utils/vcr

Private workspace. It provides the `cassette` fixture, bundled into [`@archont561/bun-test-utils`](../bun-test-utils/README.md). It records and replays two things:

- **Callback results.** `cassette(callback)` is the get-or-record form: it replays a result when available and records a safe local `auto` miss with a visible warning. `cassette.record(callback)` and `cassette.replay(callback)` retain explicit control. Values beyond plain data are handled by versioned serializers, and custom ones are added with `cassette.addSerializer(...)`.
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

The helper-only `@archont561/bun-test-utils/vcr` subpath exports `defineCallbackSerializer` and the `CallbackSerializer` type. It exports no fixture.

The stable contract is callable `cassette(fn)`, explicit `record`/`replay`, `addSerializer`, and exact HTTP matching. In local `auto` mode only, a callable callback source miss re-records and warns; HTTP misses, explicit replay, CI, and serializer version mismatches remain errors. Matcher DSLs, configurable redaction, and migration tooling are not part of this release. The on-disk formats are not yet stable.

See the [cassette guide](https://archont561.github.io/bun-test-utils/guides/recording-http-cassettes/) for the full behaviour, and [spec 0012](../../.backlog/docs/specs/0012-http-cassette-vcr.md) for the requirements.

## Develop

```bash
cd packages/vcr
bun run test
bun run test:bdd
bun run typecheck
```
