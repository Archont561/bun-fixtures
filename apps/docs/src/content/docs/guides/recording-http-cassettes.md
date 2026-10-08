---
title: Recording HTTP Cassettes
description: Record callback results and replay exact HTTP requests with the root cassette fixture.
---

> Fixture composition is explicit: `fixtures.ts` and `conftest.ts` are not automatically loaded. Compose project fixtures with `test.extend()`; built-in capabilities are fixtures on the root `test` context.

The built-in `cassette` fixture provides a deliberately small stable contract:

- `cassette.record(callback)` executes a callback once and stores its serializable result;
- `cassette.replay(callback)` returns the stored result without executing the callback; and
- HTTP replay matches one way only: the uppercase method and full URL must both match exactly.

Matcher DSLs, configurable redaction, and cassette migration tooling are deferred.

## Installation

`cassette` is available on the root `test` context with no extra dependency:

```bash
bun add -d @archont561/bun-test-utils
```

## Record and replay a callback

```ts
import { expect, test } from "@archont561/bun-test-utils";

test("replays a user lookup", async ({ cassette }) => {
  let calls = 0;
  const loadUser = async () => {
    calls++;
    return { id: "user-1", name: "Ada" };
  };

  expect(await cassette.record(loadUser)).toEqual({
    id: "user-1",
    name: "Ada",
  });
  expect(await cassette.replay(loadUser)).toEqual({
    id: "user-1",
    name: "Ada",
  });
  expect(calls).toBe(1);
});
```

A callback is identified by its function object once the test has recorded it, so
replay the same function you recorded. A new function is matched by its source
text only when every recording with that text holds the same result. Otherwise
`replay` throws `CALLBACK_AMBIGUOUS` and does not run the callback. Two closures
created by one factory are separate callbacks: each runs once and keeps its own
result. A new closure with different captured values still matches agreeing
recordings of the same code, so replay the closure you recorded when values differ.

A callback result must be plain data: `null`, booleans, strings, finite numbers
other than `-0`, arrays without holes, and plain objects. JSON cannot represent
anything else exactly, so `record` throws a `CassetteError` with the code
`CALLBACK_NOT_SERIALIZABLE`, names the path of the value, and stores nothing.
Convert the value inside the callback first:

```ts
// Refused: a Date, a Map, and a BigInt do not survive JSON.
const rawAccount = () => ({
  createdAt: new Date(0),
  roles: new Map([["admin", true]]),
  balance: 10n,
});

// Accepted: convert inside the callback.
const account = () => ({
  createdAt: new Date(0).toISOString(),
  roles: Object.fromEntries(new Map([["admin", true]])),
  balance: String(10n),
});
```

## Record and replay HTTP traffic

Set `VCR_MODE=record` for the live run, then `VCR_MODE=replay` for offline runs:

```bash
VCR_MODE=record bun test tests/user.test.ts
VCR_MODE=replay bun test tests/user.test.ts
```

```ts
import { expect, test } from "@archont561/bun-test-utils";

test("fetches user details", async ({ cassette }) => {
  // Requesting the fixture activates interception for this test.
  expect(cassette).toBeDefined();
  const response = await fetch("https://api.example.test/users/user-1");
  expect(await response.json()).toEqual({ id: "user-1" });
});
```

Replay compares the uppercase request method and full URL exactly. It does not
perform partial URL, regular-expression, body, or custom predicate matching.
An unmatched replay request fails instead of reaching the network.

## Files and secrets

The current implementation writes deterministic JSON under `__cassettes__/`
next to the test. The exact file schema is not yet a stable public format, and
migration tooling is deferred; treat cassette files as generated test artifacts
owned by the version that recorded them.

Do not record secrets. Configurable redaction is outside the stable release
contract, so remove or replace credentials before a request reaches the
recorder.

The real `globalThis.fetch` is restored when the fixture tears down, including
when the test fails.
