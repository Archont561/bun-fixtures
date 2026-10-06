# @bun-test-utils/snapshot

> **Internal workspace.** Bundled into the published
> [`bun-test-utils`](https://github.com/Archont561/bun-test-utils) package as the
> `bun-test-utils/snapshot` subpath; never published on its own.

Value and file snapshot testing: the `snapshot` fixture records, matches, or updates named
snapshots, with pluggable serializers and a CI-strict mode that refuses to write missing
snapshots on CI.

```ts
import snapshotFixtures, { snapshotFixture } from "bun-test-utils/snapshot";

test("renders a greeting", async ({ snapshot }) => {
  snapshot.match({ greeting: "hello ada", ok: true }, "greeting");
});

test("binary artifact", async ({ snapshot, tmpdir }) => {
  const file = tmpdir.write("report.html", "<h1>report</h1>");
  snapshot.matchFile(file, "report-html");
});
```

No third-party dependencies — nothing extra to install.

## The `SnapshotHelper`

| Member | Role |
| --- | --- |
| `mode` / `setMode(mode)` | `"match"` (default), `"update"` (rewrite snapshots), `"ci"` (fail when a snapshot is missing instead of writing it) |
| `match(value, name?)` | Compare a value to its stored snapshot; anonymous calls get deterministic numbering |
| `matchFile(filePath, name?)` | Same, reading the actual value from a file on disk |
| `addSerializer(serializer)` | Custom `Serializer`; registered serializers run before the built-ins, most recent first |
| `path` | Directory holding the snapshot files |

## Further reading

- Docs guide: [snapshot testing](https://archont561.github.io/bun-test-utils/guides/snapshot-testing/)
- Spec: [0013 snapshot testing](../../.backlog/docs/specs/0013-snapshot-testing.md)
- Sources in `src/`, focused tests in `tests/`

## License

[MIT](../../LICENSE-MIT) OR [Apache-2.0](../../LICENSE-APACHE), same as the repository.
