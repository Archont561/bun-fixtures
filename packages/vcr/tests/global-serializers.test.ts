/**
 * Process-wide callback serializers (ADR 0040).
 *
 * The public `/vcr` API stores registrations in a Symbol.for-backed array so
 * separately bundled preload and root-fixture copies share them. These focused
 * tests pin the codec ordering and cleanup semantics; the packed consumer test
 * proves the two-bundle preload path.
 */
import { afterAll, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FixtureContext } from "@bun-test-utils/core";
import {
  type CassetteError,
  cassetteFixture,
  createSerializerCodec,
  defineCallbackSerializer,
  describe,
  expect,
  registerCallbackSerializer,
  unregisterCallbackSerializer,
} from "@/index.ts";

const scratchDir = mkdtempSync(join(tmpdir(), "vcr-global-serializers-"));
afterAll(() => rmSync(scratchDir, { recursive: true, force: true }));

class Point {
  constructor(
    readonly x: number,
    readonly y: number,
  ) {}
}

function pointSerializer(name: string, version = 1) {
  return defineCallbackSerializer<Point>({
    name,
    version,
    test: (value) => value instanceof Point,
    serialize: (value) => ({ x: value.x, y: value.y }),
    deserialize: (data) => {
      const { x, y } = data as { x: number; y: number };
      return new Point(x, y);
    },
  });
}

function captureError(action: () => unknown): CassetteError {
  try {
    action();
  } catch (error) {
    return error as CassetteError;
  }
  throw new Error("Expected a cassette error");
}

function setVcrMode(mode: string): () => void {
  const prior = process.env.VCR_MODE;
  process.env.VCR_MODE = mode;
  return () => {
    if (prior === undefined) delete process.env.VCR_MODE;
    else process.env.VCR_MODE = prior;
  };
}

describe("global callback serializers (ADR 0040)", () => {
  test("a registered serializer applies to every new cassette codec", () => {
    const serializer = pointSerializer("global-point");
    expect(registerCallbackSerializer(serializer)).toBe(serializer);
    try {
      const codec = createSerializerCodec();
      const encoded = codec.encode({ point: new Point(2, 3) });
      expect(encoded).toContain('"name":"global-point"');
      expect(codec.decode<unknown>(encoded)).toEqual({
        point: new Point(2, 3),
      });
    } finally {
      expect(unregisterCallbackSerializer(serializer)).toBe(true);
    }
    expect(unregisterCallbackSerializer(serializer)).toBe(false);
  });

  test("a globally registered serializer is available to the cassette fixture", async () => {
    const serializer = pointSerializer("global-fixture-point");
    registerCallbackSerializer(serializer);
    const restore = setVcrMode("passthrough");
    try {
      let calls = 0;
      await cassetteFixture.setup(
        async (cassette) => {
          const load = () => {
            calls++;
            return new Point(4, 5);
          };
          expect(await cassette.record(load)).toEqual(new Point(4, 5));
          expect(await cassette.replay(load)).toEqual(new Point(4, 5));
          expect(calls).toBe(1);
        },
        {
          testFile: join(scratchDir, "fixture.test.ts"),
          testName: "uses global serializer",
        } satisfies FixtureContext,
      );
    } finally {
      restore();
      unregisterCallbackSerializer(serializer);
    }
  });

  test("fixture-local serializers take precedence over global serializers", () => {
    const global = pointSerializer("global-point");
    const local = pointSerializer("local-point");
    registerCallbackSerializer(global);
    try {
      const codec = createSerializerCodec();
      codec.add(local);
      const encoded = codec.encode(new Point(8, 13));
      expect(encoded).toContain('"name":"local-point"');
      expect(encoded).not.toContain('"name":"global-point"');
      expect(codec.decode<unknown>(encoded)).toEqual(new Point(8, 13));
    } finally {
      unregisterCallbackSerializer(global);
    }
  });

  test("unregister removes all registrations of the exact serializer identity", () => {
    const serializer = pointSerializer("duplicated-global-point");
    const equalButDistinctSerializer = pointSerializer(
      "duplicated-global-point",
    );
    registerCallbackSerializer(serializer);
    registerCallbackSerializer(serializer);
    registerCallbackSerializer(equalButDistinctSerializer);
    try {
      expect(unregisterCallbackSerializer(serializer)).toBe(true);
      expect(unregisterCallbackSerializer(serializer)).toBe(false);
      expect(createSerializerCodec().encode(new Point(1, 1))).toContain(
        '"name":"duplicated-global-point"',
      );
    } finally {
      unregisterCallbackSerializer(equalButDistinctSerializer);
    }

    const error = captureError(() =>
      createSerializerCodec().encode(new Point(1, 1)),
    );
    expect(error.code).toBe("CALLBACK_NOT_SERIALIZABLE");
  });

  test("global registration validates the same serializer contract as addSerializer", () => {
    const error = captureError(() =>
      registerCallbackSerializer({ name: "broken" } as never),
    );
    expect(error.code).toBe("INVALID_API_USAGE");
    expect(error.message).toContain("registerCallbackSerializer");
  });

  test("a global same-name version mismatch stays a decoder error", () => {
    const v2 = pointSerializer("versioned-point", 2);
    registerCallbackSerializer(v2);
    try {
      const v1 = JSON.stringify({
        __bunTestUtils: {
          name: "versioned-point",
          version: 1,
          data: { x: 21, y: 34 },
        },
      });
      const error = captureError(() => createSerializerCodec().decode(v1));
      expect(error.code).toBe("CALLBACK_SERIALIZER_NOT_FOUND");
      expect(error.details).toMatchObject({
        name: "versioned-point",
        version: 1,
      });
    } finally {
      unregisterCallbackSerializer(v2);
    }
  });
});
