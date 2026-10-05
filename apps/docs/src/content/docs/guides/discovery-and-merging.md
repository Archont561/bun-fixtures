---
title: Discovery & Merging
description: How bun-test-utils walks your directory tree and merges fixture definitions.
---

## Directory Hierarchy

Fixtures declared in parent folders are inherited by all child folders.

```
fixtures.ts                 # Declares: server, db, user
tests/
  fixtures.ts               # Overrides: db, Adds: apiClient
  api/
    checkout.test.ts        # Sees: server, user (root), db, apiClient (tests/)
```

### Merging Strategy

1. **Root-to-Leaf**: Fixture maps are merged from the root directory down to the test file's directory.
2. **Nearest Wins**: A definition closer to the test file overrides an identically named definition from an ancestor.
3. **Sibling Isolation**: Sibling directories cannot see each other's fixtures.
