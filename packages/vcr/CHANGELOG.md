# @bun-fixture/vcr

## 0.1.0

Initial release: HTTP cassette (record & replay) fixtures.

- `cassette` fixture intercepts `globalThis.fetch`, recording live HTTP requests to disk and replaying them deterministically offline.
- Automatic cassette paths: `__cassettes__/<test name>.json` next to the test file — auto-saved on teardown in record mode, auto-loaded at setup in replay mode, exposed as `cassette.path`; explicit `save()` / `load()` remain for custom paths.
- `record` / `replay` / `passthrough` modes, switchable through the API or the `VCR_MODE` environment variable.
- Automatic redaction of sensitive headers (`Authorization`, `Cookie`, `x-api-key`, extensible via `redactHeader`) and restoration of the real `fetch` on teardown.
