# M7 — API contract and database integration testing

**Task:** `task_053`  
**Target:** v0.3.0

## Dependencies

M1 fixture engine, M6 test workflow, and the test-server lifecycle.

## Scope

- OpenAPI-backed local mock and validation server.
- Request/response validation, examples, explicit operation overrides, and request history.
- Adapter-based database lifecycle fixture with transaction/schema isolation.
- Consumer-owned factories composed through `test.extend()`.

## Exit criteria

- Invalid OpenAPI requests and responses produce actionable diagnostics.
- Database state is isolated and always torn down after a test or property iteration.
- API, database, and factory examples are documented with consumer tests.
