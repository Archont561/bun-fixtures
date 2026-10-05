# @bun-fixture/vcr

HTTP Cassette and VCR network record & replay fixtures for `bun-fixture`.

## Features

- **`cassette`**: Intercepts `globalThis.fetch` to record live HTTP requests and replay them deterministically offline.
- **Configurable Modes**: `record`, `replay`, `passthrough` (controlled via API or `VCR_MODE` env var).
- **Header Redaction**: Automatically redacts sensitive authentication headers (`Authorization`, `Cookie`, `x-api-key`).

## Installation

```bash
bun add -d @bun-fixture/vcr
```

## Usage

In your `fixtures.ts`:

```ts
import vcrFixtures from "@bun-fixture/vcr";

export default {
  ...vcrFixtures,
};
```

In your test file:

```ts
import { test, expect } from "bun-fixture";

test("fetches user details with cached cassette", async ({ cassette }) => {
  const res = await fetch("https://api.github.com/users/octocat");
  const user = await res.json();
  
  expect(user.login).toBe("octocat");
});
```

## License

Dual-licensed under either of [Apache-2.0](./LICENSE-APACHE) or
[MIT](./LICENSE-MIT) at your option — SPDX `MIT OR Apache-2.0`.
