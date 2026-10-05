---
title: Getting Started
description: Deep dive into setting up bun-test-utils in your project.
---

`bun-test-utils` integrates directly with Bun's native test runner (`bun test`) to provide scoped fixture injection without global monkey-patching.

## How it works

When `bun test` starts, the preloaded plugin walks your workspace looking for `fixtures.ts` or `conftest.ts` files. It indexes fixture definitions per directory.

When an individual test file calls `test("name", async ({ fixtureA }) => ...)`:
1. The test runner parses the destructured parameters.
2. It looks up the merged fixture map for that directory.
3. Dependencies are topologically sorted.
4. Fixtures are instantiated and cached according to their scope.
5. The test executes.
6. Test-scoped teardowns run immediately.
7. File-scoped teardowns run when the runner moves to the next test file.
8. Session-scoped teardowns run at test process completion.
