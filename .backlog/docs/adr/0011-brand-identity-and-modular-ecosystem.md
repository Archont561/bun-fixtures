# 0011 — Brand Identity and Modular Ecosystem Architecture

- **Status:** accepted

## Context

As the scope of `bun-fixture` broadens to cover advanced testing paradigms (Property-Based Testing, UI/DOM component testing, E2E browser testing, HTTP cassette recording), we evaluated whether to rename the product into a broader test framework brand (e.g. `furnish`, `bunit`, `buntest`).

## Decision

1. **Retain `bun-fixture` as the flagship product and core engine name.**
   - Unbeatable discoverability and SEO for Bun developers looking for Pytest/Playwright-style fixtures and dependency injection.
   - Clear, trustworthy Unix-philosophy positioning.

2. **Adopt a Microkernel + Modular Ecosystem Architecture:**
   - `packages/bun-fixture`: Core DI engine, scoping (`session`, `file`, `test`), auto-discovery, LIFO teardown, parameter matrices.
   - Companion workspace packages:
     - `@bun-fixture/std` (or built-in): Zero-dependency standard fixtures (`tmpdir`, `env`, `stdio`).
     - `@bun-fixture/fast-check`: Property-Based Testing (`test.prop`) with fixture DI and shrink-safe teardown.
     - `@bun-fixture/dom`: In-memory DOM fixtures (`happy-dom`) for React/Vue/UI components.
     - `@bun-fixture/browser`: Real headless browser fixtures (Playwright Chromium/Firefox/WebKit).
     - `@bun-fixture/vcr`: Network record/replay cassettes for HTTP requests.

## Consequences

**Good** — Core package remains lightweight with zero unnecessary dependencies; users can cherry-pick higher-level capabilities as needed; high search relevance in the Bun ecosystem is preserved.

**Bad** — Multiple workspace packages to publish and version independently.
