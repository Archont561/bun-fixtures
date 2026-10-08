# M10 — Read-only local MCP test server

**Task:** `task_056`  
**Target:** v1.2.0

## Dependencies

M9 local report artifacts.

## Scope

- Read-only stdio MCP server for local test results and artifacts.
- Test discovery, failure inspection, fixture timelines, coverage, snapshots, and browser artifacts.
- Explicit opt-in for test execution or file mutation in future milestones.

## Exit criteria

- MCP tools and resources work without a hosted service.
- Read-only mode is safe by default and does not expose arbitrary shell execution.
- The MCP server consumes the same versioned artifacts as the browser report.
