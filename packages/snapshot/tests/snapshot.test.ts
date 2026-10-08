/**
 * The snapshot fixture, composed the way a consumer composes it.
 *
 * `createTest(<path>)` binds the fixture-aware `test` to a *scratch* test
 * file, so the `__snapshots__/<test name>.snap.json` convention resolves
 * inside a temp directory rather than next to this source file. The engine
 * still supplies `testFile` and `testName` and still owns setup/teardown —
 * nothing here hand-drives the fixture — but the suite stays hermetic: a
 * fresh directory per run means the "records on first run" assertions are
 * true on every run, not just the first.
 *
 * The fixture writes during teardown, after the body returns, so each
 * on-disk assertion lives in the test that follows its writer. The snapshot
 * path is derived from the *test name* only, which is why the record/replay
 * pair below reuses one name across two describe blocks: same name, same
 * snapshot file, so the second test genuinely matches what the first stored.
 */

import { afterAll } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTest } from "@bun-test-utils/core";
import snapshotFixtures, { describe, expect } from "@/index.ts";

const scratchDir = mkdtempSync(join(tmpdir(), "snapshot-scratch-"));
const scratchFile = join(scratchDir, "widget.test.ts");
afterAll(() => rmSync(scratchDir, { recursive: true, force: true }));

/** Mirrors the fixture's own slug rule, so expected paths cannot drift. */
const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "snapshot";

const pathFor = (testName: string) =>
  join(scratchDir, "__snapshots__", `${slugify(testName)}.snap.json`);

const read = (testName: string) =>
  JSON.parse(readFileSync(pathFor(testName), "utf8"));

/** Seeds a stale snapshot at the conventional path for `testName`. */
const seed = (testName: string, value: unknown) => {
  mkdirSync(join(scratchDir, "__snapshots__"), { recursive: true });
  writeFileSync(pathFor(testName), JSON.stringify({ value }), "utf8");
};

const { test: scratchTest } = createTest(scratchFile);
const test = scratchTest.extend(snapshotFixtures);

const RECORD_REPLAY = "renders the widget";
const STALE = "has a stale value";
const REFRESHED = "gets refreshed";
const NEVER_RECORDED = "never recorded yet";
const AUTONUMBER = "takes three snapshots";
const SERIALIZED = "serializes a custom type";
const REPORT = "renders a report";
const NESTED = "stable nested value";

seed(STALE, "old");
seed(REFRESHED, "old");

describe("@bun-test-utils/snapshot — first run", () => {
  test(RECORD_REPLAY, async ({ snapshot }) => {
    // Force "match" regardless of ambient CI detection: this asserts the
    // fixture's first-run recording behaviour, not the CI guard rail.
    snapshot.setMode("match");
    expect(snapshot.path).toBe(pathFor(RECORD_REPLAY));
    expect(existsSync(snapshot.path)).toBe(false);
    snapshot.match({ name: "widget", count: 3 });
  });

  test("…and its teardown wrote the snapshot to disk", async () => {
    expect(existsSync(pathFor(RECORD_REPLAY))).toBe(true);
    expect(Object.keys(read(RECORD_REPLAY))).toEqual(["value"]);
  });
});

describe("@bun-test-utils/snapshot — second run", () => {
  // Same test name ⇒ same snapshot file as the first-run block above.
  test(RECORD_REPLAY, async ({ snapshot }) => {
    snapshot.setMode("match");
    expect(existsSync(snapshot.path)).toBe(true);
    expect(() => snapshot.match({ count: 3, name: "widget" })).not.toThrow();
  });
});

describe("@bun-test-utils/snapshot", () => {
  test(STALE, async ({ snapshot }) => {
    snapshot.setMode("match");
    let err: Error | undefined;
    try {
      snapshot.match("new");
    } catch (caught) {
      err = caught as Error;
    }
    expect(err?.message).toContain('Snapshot "value" mismatch');
    expect(err?.message).toContain("old");
    expect(err?.message).toContain("new");
    expect(err?.message).toContain("SNAPSHOT_MODE=update");
  });

  test(REFRESHED, async ({ snapshot }) => {
    snapshot.setMode("update");
    expect(() => snapshot.match("new")).not.toThrow();
  });

  test("…and update mode overwrote the stale snapshot on teardown", async () => {
    expect(read(REFRESHED).value).toBe("new");
  });

  test(NEVER_RECORDED, async ({ snapshot }) => {
    snapshot.setMode("ci");
    let err: Error | undefined;
    try {
      snapshot.match("value");
    } catch (caught) {
      err = caught as Error;
    }
    expect(err?.message).toContain("mode=ci never creates new snapshots");
  });

  test("…and ci mode recorded nothing on teardown", async () => {
    expect(existsSync(pathFor(NEVER_RECORDED))).toBe(false);
  });

  test(AUTONUMBER, async ({ snapshot }) => {
    snapshot.setMode("match");
    snapshot.match("a");
    snapshot.match("b");
    snapshot.match("c", "named");
  });

  test("…and anonymous snapshots were auto-numbered", async () => {
    expect(read(AUTONUMBER)).toEqual({
      value: "a",
      "value 2": "b",
      named: "c",
    });
  });

  test(SERIALIZED, async ({ snapshot }) => {
    class Point {
      constructor(
        public x: number,
        public y: number,
      ) {}
    }
    snapshot.setMode("match");
    snapshot.addSerializer((value: unknown) =>
      value instanceof Point ? `Point(${value.x}, ${value.y})` : undefined,
    );
    snapshot.match({ point: new Point(1, 2) });
  });

  test("…and the custom serializer ran before the built-ins", async () => {
    expect(read(SERIALIZED).value).toBe('{\n  "point": "Point(1, 2)"\n}');
  });

  test(REPORT, async ({ snapshot }) => {
    const reportPath = join(scratchDir, "report.txt");
    writeFileSync(reportPath, "total: 42\n");
    snapshot.setMode("match");
    expect(() => snapshot.matchFile(reportPath, "report")).not.toThrow();
  });

  test("…and matchFile stored the file contents", async () => {
    expect(read(REPORT).report).toBe("total: 42\n");
  });

  test("matchFile throws when the file does not exist", async ({
    snapshot,
  }) => {
    snapshot.setMode("match");
    let err: Error | undefined;
    try {
      snapshot.matchFile(join(scratchDir, "nope.txt"));
    } catch (caught) {
      err = caught as Error;
    }
    expect(err?.message).toContain("File not found");
  });

  test(NESTED, async ({ snapshot }) => {
    snapshot.setMode("match");
    snapshot.match(new Error("boom"), "error");
    snapshot.match({ z: [2n, { b: "second", a: "first" }] });
  });

  test("…and nested values serialized deterministically", async () => {
    const stored = read(NESTED);
    expect(stored.error).toBe("Error: boom");
    expect(stored.value).toContain('"z": [');
    expect(stored.value).toContain('"2n"');
    expect(stored.value.indexOf('"a"')).toBeLessThan(
      stored.value.indexOf('"b"'),
    );
  });
});
