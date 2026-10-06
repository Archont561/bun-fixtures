# @bun-test-utils/vcr

> **Internal workspace.** Bundled into the published
> [`bun-test-utils`](https://github.com/Archont561/bun-test-utils) package as the
> `bun-test-utils/vcr` subpath; never published on its own.

HTTP cassette testing: the `cassette` fixture records real `fetch` traffic the first time
and replays it deterministically afterwards, VCR-style. Sensitive headers are redacted
before anything touches disk.

```ts
import vcrFixtures, { cassetteFixture } from "bun-test-utils/vcr";

test("hits the API", async ({ cassette }) => {
  const res = await fetch("https://api.example.com/status");
  expect(res.status).toBe(200);
  // first run records; subsequent runs replay from the cassette file
});
```

No third-party dependencies — nothing extra to install.

## Callback record and replay

For deterministic application-level results, use `record` and `replay` with the same
callback identity. `record` runs the callback once; `replay` returns its serialized result
without invoking live work:

```ts
const loadUser = () => api.users.get("user-1");
const recorded = await cassette.record(loadUser);
const replayed = await cassette.replay(loadUser);
```

A missing callback entry fails with an actionable error. Direct API calls remain live, and
HTTP interception continues to use the existing record/replay modes.

## The `CassetteHelper`

| Member | Role |
| --- | --- |
| `mode` / `setMode(mode)` | `"record"` (hit the network and save), `"replay"` (serve from file only), `"passthrough"` (bypass recording entirely) |
| `entries` | The recorded `CassetteEntry[]` — `{ request, response }` pairs |
| `redactHeader(name)` | Strip a header (e.g. `authorization`) from everything written to disk |
| `path` | Active cassette file path |
| `save(filePath)` / `load(filePath)` | Explicit persistence controls |

Cassette files follow the conventional `__cassettes__/<test-name>.json` layout beside the
test file, so they are diffable and reviewable artifacts you commit with the test.

## Further reading

- Docs guide: [recording HTTP cassettes](https://archont561.github.io/bun-test-utils/guides/recording-http-cassettes/)
- Spec: [0012 HTTP cassette VCR](../../.backlog/docs/specs/0012-http-cassette-vcr.md)
- Sources in `src/`, focused tests in `tests/`

## License

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE), same as the repository.
