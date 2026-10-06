import { describe, expect, test } from "bun:test";
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
import type { FixtureContext } from "bun-test-utils";
import { snapshotFixture } from "@/index.ts";

/**
 * Direct fixture calls pass a scratch `testFile` in `tmp` so any automatic
 * snapshot writes stay out of the repository — under the engine, the
 * convention lands next to the real test file instead.
 */
function scratch(testName?: string): { dir: string; ctx: FixtureContext } {
  const dir = mkdtempSync(join(tmpdir(), "snapshot-scratch-"));
  return { dir, ctx: { testFile: join(dir, "widget.test.ts"), testName } };
}

describe("@bun-test-utils/snapshot", () => {
  test("records a new snapshot on first run, then passes on replay", async () => {
    const { dir, ctx } = scratch("renders the widget");
    const snapshotPath = join(
      dir,
      "__snapshots__",
      "renders-the-widget.snap.json",
    );

    try {
      await snapshotFixture.setup(async (snap) => {
        // Force "match" regardless of ambient CI env detection — this test
        // proves the fixture's own first-run recording behaviour against a
        // scratch dir, not the "never record under CI" guard rail.
        snap.setMode("match");
        expect(snap.path).toBe(snapshotPath);
        expect(existsSync(snapshotPath)).toBe(false);
        snap.match({ name: "widget", count: 3 });
      }, ctx);
      expect(existsSync(snapshotPath)).toBe(true);

      const stored = JSON.parse(readFileSync(snapshotPath, "utf8"));
      expect(Object.keys(stored)).toEqual(["value"]);

      // Second run: identical value against the now-stored snapshot passes.
      await snapshotFixture.setup(async (snap) => {
        snap.setMode("match");
        expect(() => snap.match({ count: 3, name: "widget" })).not.toThrow();
      }, ctx);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("throws a descriptive error on mismatch in match mode", async () => {
    const { dir, ctx } = scratch("has a stale value");
    const snapshotPath = join(
      dir,
      "__snapshots__",
      "has-a-stale-value.snap.json",
    );
    mkdirSync(join(dir, "__snapshots__"), { recursive: true });
    writeFileSync(snapshotPath, JSON.stringify({ value: "old" }));

    try {
      let err: Error | undefined;
      await snapshotFixture.setup(async (snap) => {
        try {
          snap.match("new");
        } catch (e) {
          err = e as Error;
        }
      }, ctx);
      expect(err?.message).toContain('Snapshot "value" mismatch');
      expect(err?.message).toContain("old");
      expect(err?.message).toContain("new");
      expect(err?.message).toContain("SNAPSHOT_MODE=update");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("update mode overwrites a stale snapshot instead of throwing", async () => {
    const { dir, ctx } = scratch("gets refreshed");
    const snapshotPath = join(dir, "__snapshots__", "gets-refreshed.snap.json");
    mkdirSync(join(dir, "__snapshots__"), { recursive: true });
    writeFileSync(snapshotPath, JSON.stringify({ value: "old" }));

    try {
      await snapshotFixture.setup(async (snap) => {
        snap.setMode("update");
        expect(() => snap.match("new")).not.toThrow();
      }, ctx);

      const stored = JSON.parse(readFileSync(snapshotPath, "utf8"));
      expect(stored.value).toBe("new");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("ci mode fails instead of silently recording a missing snapshot", async () => {
    const { dir, ctx } = scratch("never recorded yet");

    try {
      let err: Error | undefined;
      await snapshotFixture.setup(async (snap) => {
        snap.setMode("ci");
        try {
          snap.match("value");
        } catch (e) {
          err = e as Error;
        }
      }, ctx);
      expect(err?.message).toContain("mode=ci never creates new snapshots");
      expect(
        existsSync(join(dir, "__snapshots__", "never-recorded-yet.snap.json")),
      ).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("auto-numbers anonymous snapshots within one test", async () => {
    const { dir, ctx } = scratch("takes three snapshots");
    const snapshotPath = join(
      dir,
      "__snapshots__",
      "takes-three-snapshots.snap.json",
    );

    try {
      await snapshotFixture.setup(async (snap) => {
        snap.setMode("match");
        snap.match("a");
        snap.match("b");
        snap.match("c", "named");
      }, ctx);

      const stored = JSON.parse(readFileSync(snapshotPath, "utf8"));
      expect(stored).toEqual({ value: "a", "value 2": "b", named: "c" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("custom serializers run before the built-ins", async () => {
    const { dir, ctx } = scratch("serializes a custom type");
    class Point {
      constructor(
        public x: number,
        public y: number,
      ) {}
    }

    try {
      await snapshotFixture.setup(async (snap) => {
        snap.setMode("match");
        snap.addSerializer((value) =>
          value instanceof Point ? `Point(${value.x}, ${value.y})` : undefined,
        );
        snap.match(new Point(1, 2));
      }, ctx);

      const snapshotPath = join(
        dir,
        "__snapshots__",
        "serializes-a-custom-type.snap.json",
      );
      const stored = JSON.parse(readFileSync(snapshotPath, "utf8"));
      expect(stored.value).toBe("Point(1, 2)");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("matchFile snapshots the contents of a file on disk", async () => {
    const { dir, ctx } = scratch("renders a report");
    const reportPath = join(dir, "report.txt");
    writeFileSync(reportPath, "total: 42\n");

    try {
      await snapshotFixture.setup(async (snap) => {
        snap.setMode("match");
        expect(() => snap.matchFile(reportPath, "report")).not.toThrow();
      }, ctx);

      const snapshotPath = join(
        dir,
        "__snapshots__",
        "renders-a-report.snap.json",
      );
      const stored = JSON.parse(readFileSync(snapshotPath, "utf8"));
      expect(stored.report).toBe("total: 42\n");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("matchFile throws when the file does not exist", async () => {
    const { dir, ctx } = scratch("missing file");

    try {
      let err: Error | undefined;
      await snapshotFixture.setup(async (snap) => {
        try {
          snap.matchFile(join(dir, "nope.txt"));
        } catch (e) {
          err = e as Error;
        }
      }, ctx);
      expect(err?.message).toContain("File not found");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("serializes nested values deterministically, including bigint and errors", async () => {
    const { dir, ctx } = scratch("stable nested value");
    const snapshotPath = join(
      dir,
      "__snapshots__",
      "stable-nested-value.snap.json",
    );

    try {
      await snapshotFixture.setup(async (snap) => {
        snap.setMode("match");
        snap.match(new Error("boom"), "error");
        snap.match({ z: [2n, { b: "second", a: "first" }] });
      }, ctx);

      const stored = JSON.parse(readFileSync(snapshotPath, "utf8"));
      expect(stored.error).toBe("Error: boom");
      expect(stored.value).toContain('"z": [');
      expect(stored.value).toContain('"2n"');
      expect(stored.value.indexOf('"a"')).toBeLessThan(
        stored.value.indexOf('"b"'),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
