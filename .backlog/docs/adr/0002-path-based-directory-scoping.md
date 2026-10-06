# 0002 — Path-based directory scoping (superseded)

- **Status:** superseded
- **Date:** historical

## Current decision

Path-based fixture scoping is no longer supported. The fixture engine does not
walk directories, does not load `fixtures.ts` or `conftest.ts`, and does not
merge fixture maps by filesystem ancestry.

The supported model is explicit composition through `test.extend()`:

```ts
// test.ts
import { test as base } from "bun-test-utils";
export const test = base.extend({ /* fixtures */ });
```

```ts
// example.test.ts
import { test } from "./test";
```

This ADR is retained only as a record of the removed design.
