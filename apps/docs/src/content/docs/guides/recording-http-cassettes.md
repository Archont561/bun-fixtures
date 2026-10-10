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

Callback results round-trip through reversible, versioned serializers. The
built-ins cover `Date`, `BigInt`, `Map`, `Set`, `RegExp`, `Error`, typed
arrays, `ArrayBuffer`, and the numbers JSON cannot represent (`NaN`,
`±Infinity`, `-0`):

```ts
test("replays an account", async ({ cassette }) => {
  const account = () => ({
    createdAt: new Date(0),
    roles: new Map([["admin", true]]),
    balance: 10n,
  });
  expect(await cassette.record(account)).toEqual(account());
  expect(await cassette.replay(account)).toEqual(account());
});
```

Everything else must be plain data: `null`, booleans, strings, finite numbers,
arrays without holes, and plain objects. A value no serializer claims and that
is not plain data — a class instance, nested `undefined`, a function, a
symbol, a sparse array, a circular structure — makes `record` throw a
`CassetteError` with the code `CALLBACK_NOT_SERIALIZABLE` that names the path
of the value and stores nothing. Convert the value inside the callback, or
teach the cassette the type:

```ts
import { defineCallbackSerializer } from "@archont561/bun-test-utils/vcr";

class Point {
  constructor(
    readonly x: number,
    readonly y: number,
  ) {}
}

const pointSerializer = defineCallbackSerializer<Point>({
  name: "point",
  version: 1,
  test: (value) => value instanceof Point,
  serialize: (point) => ({ x: point.x, y: point.y }),
  deserialize: (data) => {
    const { x, y } = data as { x: number; y: number };
    return new Point(x, y);
  },
});

test("replays a point", async ({ cassette }) => {
  cassette.addSerializer(pointSerializer);
  const load = () => new Point(1, 2);
  expect(await cassette.record(load)).toEqual(load());
  expect(await cassette.replay(load)).toEqual(load());
});
```

Serializers are named and versioned, and encoded payloads record both: a
serializer needed to decode a recording but not registered fails replay with
`CALLBACK_SERIALIZER_NOT_FOUND` instead of returning a wrong value, and a
serializer that throws is wrapped as `CALLBACK_SERIALIZER_FAILED` with the
original cause. Documented losses: unknown `Error` subclass constructors and
non-enumerable error properties (such as `cause`), `RegExp.lastIndex`, and
shared-reference identity.

Callback results persist per test in `__cassettes__/<test>.callbacks.json`, next
to the cassette (ADR 0035). `record` writes this run's results when the test
ends. `replay` reads them in replay mode only, so a later run replays a callback
an earlier run recorded, without running it. A callback whose body changed has
different source text, so replay refuses it with `CALLBACK_NOT_RECORDED` and names
the file to re-record. A source text recorded from more than one closure is
refused with `CALLBACK_AMBIGUOUS`, because the closures' captured values cannot
be told apart across runs. A corrupt sidecar fails at setup with
`CALLBACK_STORE_INVALID`. The cassette file still holds HTTP entries only.

## Record once, then replay HTTP traffic

The default mode is `auto`. The first run of a test records its HTTP traffic and callback results under `__cassettes__/`, next to the test file. Later runs replay them without network access:

```bash
bun test tests/user.test.ts   # first run records; later runs replay
```

Commit the `__cassettes__/` directory, so CI replays the same recordings.

`VCR_MODE` pins a mode:

- `auto` (default): replays when the cassette exists, and records when it does not. When `CI` is set, a missing cassette fails instead of recording.
- `record`: goes to the network on every run, and overwrites the cassette when the run ends.
- `replay`: never goes to the network. A missing cassette fails.
- `passthrough`: ignores the cassette.

> **Upgrading from 0.1.x:** the default used to be `record`, which hit the network and overwrote the cassette on every run. To keep that behaviour, set `VCR_MODE=record`.

A test whose body fails writes nothing in `auto`, so a broken first run cannot leave a partial recording behind.

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
In `auto` mode, a request missing from a present cassette fails with `CASSETTE_MISMATCH`, instead of reaching the network or recording silently. The message names the command to clear that test.

## Clear a recording

When a request or callback changes, clear its recording and run the test again. Clearing deletes files, so the next run records them again:

```bash
bunx test-utils cache clear --file tests/user.test.ts --test "fetches user details"
bunx test-utils cache clear --file tests/user.test.ts
bunx test-utils cache clear --all
bunx test-utils cache clear --all --dry-run
```

Choose exactly one scope:

- `--file <path>` clears every test in that file. The command finds the test names by reading the file's literal test names. A name built at runtime, such as a template literal, is not found, so clear it with `--test`.
- `--file <path> --test "<name>"` clears one test.
- `--all` clears every `__cassettes__/` and `__snapshots__/` directory under the working directory, skipping `node_modules`.

`--dry-run` lists the files and deletes nothing. The command removes `<name>.json`, `<name>.callbacks.json`, and `<name>.snap.json` files, and never a directory. Recordings are committed, so `git checkout -- <path>` restores a file deleted by mistake. Snapshots are cleared the same way; see [Snapshot testing](./snapshot-testing.md).

## Files and secrets

The current implementation writes deterministic JSON under `__cassettes__/`
next to the test: the HTTP cassette, and the callback sidecar when a test records
callbacks. The exact file schema is not yet a stable public format, and
migration tooling is deferred; treat cassette files as generated test artifacts
owned by the version that recorded them.

Do not record secrets. Configurable redaction is outside the stable release
contract, so remove or replace credentials before a request reaches the
recorder.

Committed recordings hold real response bodies. Redaction covers sensitive request headers only, so review a new recording for personal or confidential data before you commit it.

The real `globalThis.fetch` is restored when the fixture tears down, including
when the test fails.
