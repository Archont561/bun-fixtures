# @bun-fixture/vcr

## 0.1.0

Initial release: HTTP cassette (record & replay) fixtures.

- `cassette` fixture intercepts `globalThis.fetch`, recording live HTTP requests to disk and replaying them deterministically offline.
- `record` / `replay` / `passthrough` modes, switchable through the API or the `VCR_MODE` environment variable.
- Automatic redaction of sensitive headers (`Authorization`, `Cookie`, `x-api-key`, extensible via `redactHeader`) and restoration of the real `fetch` on teardown.
- Explicit `save()` / `load()` of cassette files; an automatic `__cassettes__/` directory convention is tracked for a follow-up release.
