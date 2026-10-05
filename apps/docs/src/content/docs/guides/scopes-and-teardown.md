---
title: Scopes & Teardown
description: Understanding fixture lifetimes and LIFO teardown guarantees.
---

## Available Scopes

| Scope | Instantiation | Teardown | Typical Use Case |
| :--- | :--- | :--- | :--- |
| `"session"` | Built once on first request across entire `bun test` run | Process exit / `afterAll` hook | Docker containers, heavy HTTP mock servers |
| `"file"` | Built once per test file | Closed when switching to next test file | Database connection pool, in-memory SQLite schema |
| `"test"` (**default**) | Rebuilt for every single test | Immediately after test finishes | Temporary directories, user fixtures, mock transactions |

## Scope Validity Rules

A longer-lived fixture **cannot** depend on a shorter-lived fixture. For example:
- A `session` fixture cannot depend on a `file` or `test` fixture.
- A `file` fixture cannot depend on a `test` fixture.

If a scope violation is detected, `bun-fixture` throws a clear error during test registration before any tests run.

## LIFO Teardown

Teardown is strictly Last-In, First-Out (LIFO). If Fixture A depends on Fixture B, Fixture A's teardown will complete *before* Fixture B's teardown begins.
