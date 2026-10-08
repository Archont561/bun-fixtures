# HTTP cassette fixtures (internal)

The VCR `cassette` fixture is an internal workspace fixture bundled into the public root `test` from `bun-test-utils`. There is no public `bun-test-utils/vcr` subpath.

The stable release surface is intentionally small: `record(callback)`,
`replay(callback)`, and HTTP replay matching by uppercase method plus exact full
URL. Matcher DSLs, configurable redaction, and cassette migration tooling are
deferred. Other helpers currently used inside the workspace are provisional,
not part of the stable release contract.

`record` refuses a callback result that is not plain data, such as a `Date`,
`Map`, `BigInt`, class instance, or `NaN`, with a `CALLBACK_NOT_SERIALIZABLE`
`CassetteError` (ADR 0026). A value JSON cannot round-trip never reaches replay.

```ts
import { expect, test } from "bun-test-utils";

test("records and replays a callback", async ({ cassette }) => {
  let calls = 0;
  const loadUser = () => {
    calls++;
    return { id: "user-1" };
  };

  expect(await cassette.record(loadUser)).toEqual({ id: "user-1" });
  expect(await cassette.replay(loadUser)).toEqual({ id: "user-1" });
  expect(calls).toBe(1);
});
```

Mocking and network fakes should live in fixtures so tests continue to request dependencies through the test context.

The cassette fixture is exercised in [`tests/`](./tests/) through `test.extend(...)` composition. That suite is also worth reading for two techniques: binding the fixture-aware `test` to a scratch test file with `createTest(<path>)` so the `__cassettes__/` convention resolves into a temp directory, and overriding the `cassette` key with an added `deps` entry so an environment-setting fixture builds before it and tears down after it.

Property tests in `tests/invariants.test.ts` pin record→replay identity over generated JSON values and HTTP replay matching by uppercase method plus exact full URL.

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).
