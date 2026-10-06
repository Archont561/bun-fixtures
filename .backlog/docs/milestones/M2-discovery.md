# M2 — Legacy preload discovery and merge (superseded)

- **Status:** superseded
- **Specs:** [0002](../specs/0002-discovery-and-merge.md)

## Current state

The directory-scanning milestone is historical only. The implementation and
public behavior were removed in favor of explicit `test.extend()` composition.
`fixtures.ts` and `conftest.ts` are not automatically loaded, the preload does
not walk directories, and fixtures are not inherited by filesystem ancestry.

## Supported replacement

Projects define a local runner and import it explicitly:

```ts
// test.ts
import { test as base } from "bun-test-utils";
export const test = base.extend({ /* fixtures */ });
```

```ts
// example.test.ts
import { test } from "./test";
```

This file is retained as historical context only; it is not a current milestone
exit criterion.
