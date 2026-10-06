# HTTP cassette fixtures

`bun-test-utils/vcr` records and replays `fetch` traffic. It has no extra runtime dependency.

> VCR fixtures are included only by importing `bun-test-utils/vcr` or composing `vcrFixtures` with `test.extend()`. `fixtures.ts` and `conftest.ts` are not automatically loaded.

## Record and replay callback work

```ts
import { expect, test } from "bun-test-utils/vcr";

test("replays a recorded result without repeating work", async ({ cassette }) => {
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

## Record HTTP traffic

```ts
import { expect, test } from "bun-test-utils";

test("records a local request", async ({ cassette, testServer, serverUrl }) => {
  testServer.handle(() => new Response("ok"));
  cassette.setMode("record");

  const response = await fetch(`${serverUrl}/health`);
  expect(await response.text()).toBe("ok");
  expect(cassette.entries).toHaveLength(1);
});
```

Cassettes are stored as readable JSON in `__cassettes__/<test-name>.json`. Use `record`, `replay`, or `passthrough` mode; authorization, cookie, and API-key headers are redacted by default.

See the [cassette guide](https://archont561.github.io/bun-test-utils/guides/recording-http-cassettes/) and [`tests/`](./tests/) for matching, redaction, persistence, and failure cases.

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE).
