import { afterAll } from "bun:test";
import { readFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { expect, test } from "bun-test-utils";
import * as snapApi from "bun-test-utils/snap";
import {
  createSnapshotSerializer,
  registerSnapshotSerializer,
  resetSnapshotSerializers,
  unregisterSnapshotSerializer,
} from "bun-test-utils/snap";

class LifecycleToken {
  constructor(readonly value: string) {}
}

const writtenSnapshots: string[] = [];
afterAll(() => {
  resetSnapshotSerializers();
  for (const path of writtenSnapshots) {
    rmSync(dirname(path), { recursive: true, force: true });
  }
});

test("the public snap subpath exposes serializer cleanup controls", () => {
  expect(Object.keys(snapApi).sort()).toEqual([
    "createSnapshotSerializer",
    "registerSnapshotSerializer",
    "resetSnapshotSerializers",
    "unregisterSnapshotSerializer",
  ]);
});

test("unregistering a global serializer prevents it leaking into later snapshots", async ({
  snapshot,
}) => {
  resetSnapshotSerializers();
  snapshot.setMode("match");
  writtenSnapshots.push(snapshot.path);

  const serializer = createSnapshotSerializer((value) =>
    value instanceof LifecycleToken ? `<token:${value.value}>` : undefined,
  );
  // A single unregister by function identity removes duplicate registrations too.
  registerSnapshotSerializer(serializer);
  snapshot.match(new LifecycleToken("registered"), "registered");

  expect(unregisterSnapshotSerializer(serializer)).toBe(true);
  expect(unregisterSnapshotSerializer(serializer)).toBe(false);
  snapshot.match(new LifecycleToken("unregistered"), "unregistered");
});

test("unregistered serializers are absent from the next snapshot run", () => {
  const stored = JSON.parse(readFileSync(writtenSnapshots[0]!, "utf8"));
  expect(stored).toEqual({
    registered: "<token:registered>",
    unregistered: '{\n  "value": "unregistered"\n}',
  });
});

test("resetting the global registry removes every serializer for later runs", async ({
  snapshot,
}) => {
  resetSnapshotSerializers();
  snapshot.setMode("match");
  writtenSnapshots.push(snapshot.path);

  const first = registerSnapshotSerializer((value) =>
    value instanceof LifecycleToken ? `<first:${value.value}>` : undefined,
  );
  const second = registerSnapshotSerializer((value) =>
    value instanceof LifecycleToken ? `<second:${value.value}>` : undefined,
  );
  snapshot.match(new LifecycleToken("before"), "before-reset");

  resetSnapshotSerializers();
  expect(unregisterSnapshotSerializer(first)).toBe(false);
  expect(unregisterSnapshotSerializer(second)).toBe(false);
  snapshot.match(new LifecycleToken("after"), "after-reset");
});

test("reset serializers are not applied in a later isolated snapshot", () => {
  const stored = JSON.parse(readFileSync(writtenSnapshots[1]!, "utf8"));
  expect(stored).toEqual({
    "before-reset": "<second:before>",
    "after-reset": '{\n  "value": "after"\n}',
  });
});
