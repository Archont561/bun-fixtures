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

type SnapshotDiagnostic = Error & {
  code?: string;
  details?: Record<string, unknown>;
  cause?: unknown;
};

function captureError(action: () => void): SnapshotDiagnostic {
  try {
    action();
  } catch (error) {
    return error as SnapshotDiagnostic;
  }
  throw new Error("Expected snapshot serialization to fail");
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

test("cyclic snapshot values report their location and snapshot context", async ({
  snapshot,
}) => {
  resetSnapshotSerializers();
  snapshot.setMode("match");

  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  const error = captureError(() => snapshot.match(cyclic, "cycle"));

  expect(error.name).toBe("SnapshotSerializationError");
  expect(error.code).toBe("SNAPSHOT_CIRCULAR_REFERENCE");
  expect(error.message).toBe(
    `[bun-test-utils/snapshot] Circular reference at $.self (first seen at $) while serializing snapshot "cycle" in ${snapshot.path}.`,
  );
  expect(error.details).toEqual({
    snapshotName: "cycle",
    snapshotPath: snapshot.path,
    valuePath: "$.self",
    firstSeenAt: "$",
  });
});

test("nested array serializers prefer newest fixture-local handlers", async ({
  snapshot,
}) => {
  resetSnapshotSerializers();
  snapshot.setMode("match");
  writtenSnapshots.push(snapshot.path);

  const global = registerSnapshotSerializer((value) =>
    value instanceof LifecycleToken ? `<global:${value.value}>` : undefined,
  );
  snapshot.addSerializer((value: unknown) =>
    value instanceof LifecycleToken ? `<local-old:${value.value}>` : undefined,
  );
  snapshot.addSerializer((value: unknown) =>
    value instanceof LifecycleToken ? `<local-new:${value.value}>` : undefined,
  );

  try {
    snapshot.match(
      { entries: [new LifecycleToken("nested")] },
      "nested-precedence",
    );
  } finally {
    unregisterSnapshotSerializer(global);
  }
});

test("nested array snapshot output confirms local precedence", () => {
  const stored = JSON.parse(readFileSync(writtenSnapshots[2]!, "utf8"));
  expect(stored["nested-precedence"]).toBe(
    '{\n  "entries": [\n    "<local-new:nested>"\n  ]\n}',
  );
});

test("throwing recursive serializers expose stable context and cause", async ({
  snapshot,
}) => {
  snapshot.setMode("match");
  const cause = new Error("codec exploded");
  snapshot.addSerializer((value: unknown) => {
    if (value instanceof LifecycleToken) throw cause;
    return undefined;
  });

  const error = captureError(() =>
    snapshot.match(
      { items: [new LifecycleToken("broken")] },
      "serializer-error",
    ),
  );

  expect(error.name).toBe("SnapshotSerializationError");
  expect(error.code).toBe("SNAPSHOT_SERIALIZER_FAILED");
  expect(error.message).toBe(
    `[bun-test-utils/snapshot] Serializer failed at $.items[0] while serializing snapshot "serializer-error" in ${snapshot.path}: codec exploded`,
  );
  expect(error.details).toEqual({
    snapshotName: "serializer-error",
    snapshotPath: snapshot.path,
    valuePath: "$.items[0]",
  });
  expect(error.cause).toBe(cause);
});

test("a cyclic array reports the repeated element path", async ({
  snapshot,
}) => {
  snapshot.setMode("match");
  const cyclic: unknown[] = [];
  cyclic.push(cyclic);

  const error = captureError(() => snapshot.match(cyclic, "array-cycle"));
  expect(error.code).toBe("SNAPSHOT_CIRCULAR_REFERENCE");
  expect(error.details).toEqual({
    snapshotName: "array-cycle",
    snapshotPath: snapshot.path,
    valuePath: "$[0]",
    firstSeenAt: "$",
  });
});

test("shared acyclic objects serialize repeatedly inside arrays", async ({
  snapshot,
}) => {
  snapshot.setMode("match");
  writtenSnapshots.push(snapshot.path);
  const shared = { label: "shared" };
  snapshot.match([shared, shared], "shared-reference");
});

test("shared array entries are not mistaken for a cycle", () => {
  const stored = JSON.parse(readFileSync(writtenSnapshots[3]!, "utf8"));
  expect(stored["shared-reference"]).toBe(
    '[\n  {\n    "label": "shared"\n  },\n  {\n    "label": "shared"\n  }\n]',
  );
});

test("built-in Error serialization also applies to nested array entries", async ({
  snapshot,
}) => {
  snapshot.setMode("match");
  writtenSnapshots.push(snapshot.path);
  snapshot.match({ errors: [new Error("nested failure")] }, "nested-errors");
});

test("nested Error snapshots retain the error message", () => {
  const stored = JSON.parse(readFileSync(writtenSnapshots[4]!, "utf8"));
  expect(stored["nested-errors"]).toBe(
    '{\n  "errors": [\n    "Error: nested failure"\n  ]\n}',
  );
});
