---
title: Scopes and teardown
description: How session, file, and test lifetimes work, the rules between them, and the LIFO teardown order.
---

Every fixture has a scope. The scope decides how long its value lives, and when its teardown runs.

## Scopes

| Scope | Built | Torn down | Use it for |
| :--- | :--- | :--- | :--- |
| `"session"` | Once, on first request in the run | After the last test file | A container, a shared mock server, a fixture that is expensive to start |
| `"file"` | Once per test file | When the run moves to the next file | A database connection pool, a schema loaded for one file |
| `"test"` (default) | For every test | Right after the test finishes, pass or fail | A temporary directory, a user record, a transaction |

Set the scope on the definition:

```ts
export const test = base.extend({
  container: {
    scope: "session",
    setup: async (use) => {
      const container = await startContainer();
      await use(container);
      await container.stop();
    },
  },
  connection: {
    scope: "file",
    setup: async (use, { container }) => {
      const connection = await container.connect();
      await use(connection);
      await connection.close();
    },
  },
  row: {
    setup: async (use, { connection }) => {
      const row = await connection.insert({ name: "Ada" });
      await use(row);
      await connection.delete(row.id);
    },
  },
});
```

`row` is rebuilt for every test. `connection` is shared by the tests in one file. `container` is shared by the whole run.

## Scope rules

A fixture may depend only on fixtures of equal or longer lifetime:

- A `session` fixture can depend on `session` fixtures only.
- A `file` fixture can depend on `session` and `file` fixtures.
- A `test` fixture can depend on any scope.

A rule violation fails with a `SCOPE_MISMATCH` error. The engine checks it when the test is declared, before any test body runs, and the message names both fixtures and both scopes.

## Teardown order

Teardown is strictly last-in, first-out. Each fixture's code after `await use(value)` runs only after the code of every fixture that depends on it has finished. In the example above, `row` is deleted before `connection` closes, and `connection` closes before `container` stops.

Teardown runs even when the test fails. The engine uses the same unwinding path for an assertion failure, a thrown error, and a normal finish.

## When a teardown fails

If a teardown throws while another error is already in flight, the first error is reported as the failure. Later teardown errors are attached to it as `suppressed`, so no failure is lost. A session teardown that fails outside `bun test` is reported on stderr, with the suppressed messages included.

## Setup that never calls `use`

A fixture that finishes without calling `use(value)` fails with a diagnostic that names the fixture. A `use` call is required so the engine knows the fixture is ready and when to tear it down.

## Next steps

- [Property-based testing](/bun-test-utils/guides/property-based-testing/) shows how `test` scope applies to each generated sample.
- [API reference](/bun-test-utils/reference/api/) lists the `scope` option and the `iterate` protocol.
