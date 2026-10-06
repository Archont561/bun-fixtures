# @bun-test-utils/dom

## 0.1.0

Initial release: in-memory DOM testing fixtures powered by `happy-dom`.

- `window` and `document` fixtures with automatic sandboxing and restoration of DOM globals on teardown.
- `page` helper fixture: `mount`, `querySelector`, `click`, `type`, `html` — with zero DOM globals leaked between tests.
