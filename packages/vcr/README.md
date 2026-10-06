# HTTP cassette fixtures (internal)

The VCR `cassette` fixture is an internal workspace fixture bundled into the public root `test` from `bun-test-utils`. There is no public `bun-test-utils/vcr` subpath.

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

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).
