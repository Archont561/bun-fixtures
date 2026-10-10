---
title: Recording HTTP Cassettes
description: Record a callback's result and record and replay HTTP traffic with the cassette fixture, with deterministic, committed recordings.
---

The `cassette` fixture records results once and replays them afterwards, so a test that depends on a network call or a slow computation runs the same way every time. It has two parts:

- **Callback recording.** `cassette.record(callback)` runs a callback once and stores its serializable result. `cassette.replay(callback)` returns the stored result without running the callback.
- **HTTP recording.** During a test, `fetch` traffic is captured under `__cassettes__/` on the first run and replayed from that file afterwards, with no network access.

The stable surface is intentionally small:

- `cassette.record(callback)` and `cassette.replay(callback)`;
- `cassette.addSerializer(serializer)` for custom callback values, typed with `defineCallbackSerializer` from `@archont561/bun-test-utils/vcr`;
- HTTP matching by the uppercase method and the full URL, both exact.

Matcher DSLs, configurable redaction, and cassette migration tooling are not part of this release.

## Installation

`cassette` is on the root `test` context, with no extra dependency:

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

  expect(await cassette.record(loadUser)).toEqual({ id: "user-1", name: "Ada" });
  expect(await cassette.replay(loadUser)).toEqual({ id: "user-1", name: "Ada" });
  expect(calls).toBe(1); // the callback ran once
});
```

Replay the same function you recorded. Within a run, a function is identified by its object. In a later run, a function that has the same source text as a recording is matched to it, as long as every recording with that source text holds the same result. Otherwise `replay` throws `CALLBACK_AMBIGUOUS` without running the callback.

Two closures created by one factory are separate callbacks. Each runs once and keeps its own result. A closure with different captured values can still match a recording of the same code, so replay the closure you recorded when the captured values differ.

## Serializable values

Callback results round-trip through versioned serializers. These built-ins are included:

- `Date`, `BigInt`, `Map`, `Set`, `RegExp`, `Error`
- typed arrays and `ArrayBuffer`
- `NaN`, `Infinity`, `-Infinity`, and `-0`

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

Other values must be plain data: `null`, booleans, strings, finite numbers, arrays without holes, and plain objects. Anything else makes `record` throw a `CassetteError` with the code `CALLBACK_NOT_SERIALIZABLE`. The error names the path to the value, and nothing is stored. A class instance, a function, a symbol, a sparse array, or a circular structure all fail this way.

The fix is to convert the value inside the callback, or to teach the cassette the type:

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

Serializers are named and versioned, and each encoded payload records both. Two failures are reported by code:

- `CALLBACK_SERIALIZER_NOT_FOUND`: a recording needs a serializer that is not registered. Replay fails rather than returning a wrong value.
- `CALLBACK_SERIALIZER_FAILED`: a serializer threw. The error wraps the original cause.

Some information is not preserved. The built-ins do not keep unknown `Error` subclass constructors, non-enumerable error properties such as `cause`, `RegExp.lastIndex`, or shared-reference identity.

## Callback results persist across runs

Callback results are saved per test in `__cassettes__/<test>.callbacks.json`, next to the HTTP cassette. `record` writes this run's results when the test ends. `replay` reads them in replay mode only, so a later run can replay a callback that an earlier run recorded, without running it.

Three more failures are reported by code:

- `CALLBACK_NOT_RECORDED`: the callback's body changed, so its source text no longer matches a recording. The error names the file to re-record.
- `CALLBACK_AMBIGUOUS`: one source text was recorded from more than one closure, so their captured values cannot be told apart across runs.
- `CALLBACK_STORE_INVALID`: the sidecar file is corrupt. This fails at setup.

The cassette file itself still holds only HTTP entries.

## Record and replay HTTP traffic

The default mode is `auto`. The first run of a test records its HTTP traffic under `__cassettes__/`, next to the test file, and later runs replay it without network access:

```ts
import { expect, test } from "@archont561/bun-test-utils";

test("fetches user details", async ({ cassette }) => {
  // Requesting the fixture turns interception on for this test.
  expect(cassette).toBeDefined();

  const response = await fetch("https://api.example.test/users/user-1");
  expect(await response.json()).toEqual({ id: "user-1" });
});
```

Commit `__cassettes__/`, so CI replays the same recordings.

`VCR_MODE` selects the mode for a run:

| Mode | Behaviour |
| :-- | :-- |
| `auto` (default) | Replays when the cassette exists, and records when it does not. When `CI` is set, a missing cassette fails instead of recording. |
| `record` | Goes to the network on every run and overwrites the cassette when the run ends. |
| `replay` | Never goes to the network. A missing cassette fails. |
| `passthrough` | Ignores the cassette. |

A test whose body fails writes nothing in `auto` mode, so a broken first run cannot leave a partial recording behind.

Replay compares the uppercase request method and the full URL, exactly. It does not match partial URLs, regular expressions, request bodies, or custom predicates.

Because the URL includes the port, a recording of a request to `testServer` will not replay on the next run, since that server binds a new port each time. Record against a stable URL, or stub local endpoints with `httpMock` instead. In `auto` mode, a request that is missing from an existing cassette fails with `CASSETTE_MISMATCH`. The message names the command that clears the test's recording. The request never reaches the network and is never recorded silently.

## Clear a recording

When a request or callback changes, clear its recording and run the test again. The next run records it again:

```bash
bunx test-utils cache clear --file tests/user.test.ts --test "fetches user details"
bunx test-utils cache clear --file tests/user.test.ts
bunx test-utils cache clear --all
bunx test-utils cache clear --all --dry-run
```

Choose one scope:

- `--file <path>` clears every test in the file. The command finds test names by reading the file's literal names. A name built at runtime, such as one from a template literal, is not found, so clear it with `--test`.
- `--file <path> --test "<name>"` clears one test.
- `--all` clears every `__cassettes__/` and `__snapshots__/` directory under the project root, which is the nearest `package.json` at or above the working directory, skipping `node_modules`.

`--dry-run` lists the files and deletes nothing. In an interactive terminal without `CI`, the command shows the matched files as a multi-select, all selected by default, and asks before deleting. `--yes` skips both steps. Outside a terminal, the explicit scope is the confirmation. The command removes `<name>.json`, `<name>.callbacks.json`, and `<name>.snap.json` files, and never a directory. Because recordings are committed, `git checkout -- <path>` restores a file deleted by mistake.

## Files and secrets

Recordings are deterministic JSON. The file format is not yet a stable public format, so treat cassette files as generated test artifacts, owned by the version that wrote them.

Do not record secrets. Redaction covers sensitive request headers only, and configurable redaction is not part of this release. Remove or replace credentials before a request reaches the recorder.

Committed recordings contain real response bodies. Review a new recording for personal or confidential data before you commit it.

The real `globalThis.fetch` is restored when the fixture tears down, including when the test fails.

## Next steps

- [Snapshot testing](/bun-test-utils/guides/snapshot-testing/) for the same commit-and-review workflow applied to values.
- [API reference](/bun-test-utils/reference/api/) for the cassette error codes and environment variables.
