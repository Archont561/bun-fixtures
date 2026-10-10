# HTTP cassette fixtures (internal)

The VCR `cassette` fixture is an internal workspace fixture bundled into the public root `test` from `@archont561/bun-test-utils`. There is no public `@archont561/bun-test-utils/vcr` subpath.

The stable release surface is intentionally small: `record(callback)`,
`replay(callback)`, `addSerializer(serializer)`, and HTTP replay matching by
uppercase method plus exact full URL. Matcher DSLs, configurable redaction,
and cassette migration tooling are deferred. Other helpers currently used
inside the workspace are provisional, not part of the stable release
contract.

The default `VCR_MODE=auto` replays a test whose cassette exists and records a test whose
cassette does not (ADR 0036). `bunx test-utils cache clear --file <file> [--test <name>]`
or `--all` deletes a recording so it re-records. With `CI` set, a missing cassette fails.

`record` encodes callback results through reversible, versioned serializers
(ADR 0034). Built-ins cover `Date`, `BigInt`, `Map`, `Set`, `RegExp`,
`Error`, typed arrays, `ArrayBuffer`, and the numbers JSON cannot represent
(`NaN`, `±Infinity`, `-0`); anything else must be plain data — `null`,
booleans, strings, finite numbers, arrays without holes, plain objects — or
is refused with a `CALLBACK_NOT_SERIALIZABLE` `CassetteError` naming the path
and the fix (ADR 0026). Teach the cassette your own types with
`cassette.addSerializer(...)`, defining reusable serializers with
`defineCallbackSerializer` from the public
`@archont561/bun-test-utils/vcr` subpath:

```ts
import { defineCallbackSerializer } from "@archont561/bun-test-utils/vcr";

class Point {
  constructor(readonly x: number, readonly y: number) {}
}

const pointSerializer = defineCallbackSerializer<Point>({
  name: "point",
  version: 1,
  test: (value) => value instanceof Point,
  serialize: (point) => ({ x: point.x, y: point.y }),
  deserialize: (data) => new Point(data.x, data.y),
});

test("round-trips a class instance", async ({ cassette }) => {
  cassette.addSerializer(pointSerializer);
  const load = () => ({ home: new Point(1, 2) });
  expect(await cassette.record(load)).toEqual(load());
  expect(await cassette.replay(load)).toEqual(load());
});
```

Serializer payloads carry `{ name, version }` envelopes, so encoded values
are self-describing; a missing serializer at decode time is a coded
`CALLBACK_SERIALIZER_NOT_FOUND`, and a throwing serializer is wrapped as
`CALLBACK_SERIALIZER_FAILED` with the cause. Callback results persist per test in a sidecar,
`__cassettes__/<test>.callbacks.json` (ADR 0035). Replay reads it and refuses a
changed callback body with `CALLBACK_NOT_RECORDED`, a source text that an earlier
run recorded from more than one closure with `CALLBACK_AMBIGUOUS`, and a corrupt
file with `CALLBACK_STORE_INVALID`. The cassette file holds HTTP entries only, byte-compatible with
cassettes recorded before serializers existed.

```ts
import { expect, test } from "@archont561/bun-test-utils";

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
