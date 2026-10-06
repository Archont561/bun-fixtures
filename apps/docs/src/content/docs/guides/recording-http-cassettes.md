---
title: Recording HTTP Cassettes
description: Record live fetch traffic to __cassettes__/ and replay it offline with the root cassette fixture.
---

> Fixture composition is explicit: `fixtures.ts` and `conftest.ts` are not automatically loaded. Compose project fixtures with `test.extend()`; built-in capabilities are fixtures on the root `test` context.


The built-in `cassette` fixture intercepts `globalThis.fetch` during a test: live HTTP
traffic is recorded to disk once, then replayed deterministically — offline,
fast, and immune to rate limits and flaky third parties.

## Installation

`cassette` is available on the root `test` context — zero extra dependencies:

```bash
bun add -d bun-test-utils
```

## Using the cassette fixture

```ts
import { test, expect } from "bun-test-utils";

test("fetches user details", async ({ cassette }) => {
  const res = await fetch("https://api.github.com/users/octocat");
  const user = await res.json();

  expect(user.login).toBe("octocat");
});
```

Run it once with recording enabled, commit the cassette, and every later
run — locally or in CI — replays from disk with no network traffic.

## The `__cassettes__/` convention

No file bookkeeping is required:

- The cassette for a test lives at **`__cassettes__/<test name>.json`** in
  the same directory as the test file. The helper exposes it as
  `cassette.path`.
- **Record mode** writes the recorded entries there automatically on
  teardown — only when something was actually recorded.
- **Replay mode** loads that file automatically at setup. If it doesn't
  exist, the fixture fails immediately with a hint to record it once with
  `VCR_MODE=record`.
- **Passthrough mode** never touches the file.

Commit `__cassettes__/` to version control alongside the tests — the files
are deterministic, human-readable JSON, and redacted for secrets (below).

## Modes

| Mode | Behaviour | Enable with |
| :-- | :-- | :-- |
| `record` (default) | Execute requests live and append them to the cassette | `VCR_MODE=record` or `cassette.setMode("record")` |
| `replay` | Serve responses from the cassette only; unmatched requests throw a descriptive error | `VCR_MODE=replay` or `cassette.setMode("replay")` |
| `passthrough` | Do not intercept — real `fetch` for every request | `VCR_MODE=passthrough` or `cassette.setMode("passthrough")` |

The typical workflow is `VCR_MODE=record bun test` once, then
`VCR_MODE=replay` everywhere else (CI above all).

## Header redaction

Sensitive headers never reach disk: `Authorization`, `Cookie`, `Set-Cookie`
and `x-api-key` are stored as `[REDACTED]`. Extend the list per test:

```ts
test("uses a private API", async ({ cassette }) => {
  cassette.redactHeader("x-internal-token");
  // … requests using that header
});
```

## Custom cassette paths

The convention covers the common case. When a test needs a specific file —
a shared cassette between several tests, a golden fixture — use the
explicit API:

```ts
test("uses a shared cassette", async ({ cassette }) => {
  cassette.load(`${import.meta.dir}/golden/github-user.json`);
  cassette.setMode("replay");
  // …
});
```

`cassette.entries` exposes the recorded request/response pairs for direct
inspection, and the real `globalThis.fetch` is always restored on teardown.
