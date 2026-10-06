# @bun-test-utils/vcr

HTTP Cassette and VCR network record & replay fixtures for `bun-test-utils`.

## Features

- **`cassette`**: Intercepts `globalThis.fetch` to record live HTTP requests and replay them deterministically offline.
- **Automatic cassette files**: recordings are written to `__cassettes__/<test name>.json` next to the test file — no explicit file bookkeeping.
- **Configurable Modes**: `record`, `replay`, `passthrough` (controlled via API or `VCR_MODE` env var).
- **Header Redaction**: Automatically redacts sensitive authentication headers (`Authorization`, `Cookie`, `x-api-key`).

## Installation

```bash
bun add -d @bun-test-utils/vcr
```

## Usage

In your `fixtures.ts`:

```ts
import vcrFixtures from "@bun-test-utils/vcr";

export default {
  ...vcrFixtures,
};
```

In your test file:

```ts
import { test, expect } from "bun-test-utils";

test("fetches user details with cached cassette", async ({ cassette }) => {
  const res = await fetch("https://api.github.com/users/octocat");
  const user = await res.json();
  
  expect(user.login).toBe("octocat");
});
```

## Cassette files

The fixture follows a convention, so tests need no file bookkeeping:

- The cassette for a test lives at **`__cassettes__/<test name>.json`** next
  to the test file (the helper exposes it as `cassette.path`).
- **Record mode** writes the recorded entries to that path automatically on
  teardown (only when something was recorded).
- **Replay mode** loads that path automatically at setup; if no cassette
  exists there, the fixture fails with a hint to run once with
  `VCR_MODE=record`.
- **Passthrough mode** never touches the cassette file.

Cassettes are meant to be committed — commit `__cassettes__/` so CI runs in
replay mode, offline and deterministic. `save()` / `load()` remain available
when a test wants an explicit path instead.

## License

Dual-licensed under either of [Apache-2.0](./LICENSE-APACHE) or
[MIT](./LICENSE-MIT) at your option — SPDX `MIT OR Apache-2.0`.
