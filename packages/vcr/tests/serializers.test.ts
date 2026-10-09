/**
 * The callback value codec (ADR 0034), at the internal boundary.
 *
 * `createSerializerCodec` is the provisional engine behind
 * `cassette.addSerializer` / `record` / `replay`: it encodes a callback
 * result to the stored text and decodes it back. These tests pin the wire
 * format (`__bunTestUtils` envelopes with `name` + `version`), the built-in
 * serializer set, ordering, the refusal fallback, and the coded diagnostics
 * for missing or failing serializers. Fixture-level behaviour lives in
 * `cassette.test.ts`.
 */
import {
  type CallbackSerializer,
  CassetteError,
  createSerializerCodec,
  defineCallbackSerializer,
  describe,
  expect,
  test,
} from "@/index.ts";

/** The wire format is pinned literally: it is the versionable contract. */
const ENVELOPE_KEY = "__bunTestUtils";

function codec() {
  return createSerializerCodec();
}

function expectCassetteError(
  fn: () => unknown,
  code: CassetteError["code"],
): CassetteError {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(CassetteError);
  const error = caught as CassetteError;
  expect(error.code).toBe(code);
  expect(error.message.startsWith("[bun-test-utils/vcr] ")).toBe(true);
  return error;
}

/** A serializer whose hooks throw, for the wrapping diagnostics. */
function throwingSerializer(phase: "test" | "serialize" | "deserialize") {
  const boom = new Error(`boom in ${phase}`);
  return {
    error: boom,
    serializer: defineCallbackSerializer<string>({
      name: "thrower",
      version: 1,
      test: (value: unknown) => {
        if (phase === "test" && typeof value === "string") throw boom;
        return typeof value === "string";
      },
      serialize: (value: string) => {
        if (phase === "serialize") throw boom;
        // A number the serializer does not claim: encoding terminates.
        return { length: value.length };
      },
      deserialize: (data: unknown) => {
        if (phase === "deserialize") throw boom;
        return "x".repeat((data as { length: number }).length);
      },
    }),
  };
}

describe("callback codec: wire format", () => {
  test("encodes plain data byte-identically to JSON.stringify", () => {
    const c = codec();
    const values: unknown[] = [
      null,
      true,
      "text",
      42,
      0,
      0.5,
      [1, "two", null],
      { id: "user-1", tags: ["admin"], meta: { empty: [], nothing: {} } },
      Object.assign(Object.create(null), { id: "x" }),
    ];
    for (const value of values) {
      const encoded = c.encode(value);
      if (value === undefined) continue;
      expect(encoded).toBe(JSON.stringify(value));
      expect(c.decode<unknown>(encoded)).toEqual(value);
    }
  });

  test("round-trips a top-level undefined through the sentinel", () => {
    const c = codec();
    expect(c.encode(undefined)).toBe("__undefined__");
    expect(c.decode<unknown>("__undefined__")).toBeUndefined();
  });

  test("wraps a serialized position in a name+version envelope", () => {
    const c = codec();
    expect(c.encode(new Date(0))).toBe(
      JSON.stringify({
        [ENVELOPE_KEY]: {
          name: "date",
          version: 1,
          data: "1970-01-01T00:00:00.000Z",
        },
      }),
    );
  });

  test("refuses the reserved envelope key in plain data, at the offending path", () => {
    const c = codec();
    const top = expectCassetteError(
      () => c.encode({ [ENVELOPE_KEY]: 1 }),
      "CALLBACK_NOT_SERIALIZABLE",
    );
    expect(top.details).toMatchObject({ path: "$" });
    expect(top.message).toContain(ENVELOPE_KEY);

    const nested = expectCassetteError(
      () => c.encode({ user: { [ENVELOPE_KEY]: { name: "date" } } }),
      "CALLBACK_NOT_SERIALIZABLE",
    );
    expect(nested.details).toMatchObject({ path: "$.user" });
  });
});

describe("callback codec: built-in serializers (v1)", () => {
  test("round-trips a Date", () => {
    const c = codec();
    const date = new Date("2026-10-09T12:34:56.789Z");
    expect(c.decode<unknown>(c.encode(date))).toEqual(date);
    expect(c.decode<unknown>(c.encode(new Date(0)))).toEqual(new Date(0));
  });

  test("refuses an invalid Date instead of encoding one", () => {
    const c = codec();
    const error = expectCassetteError(
      () => c.encode(new Date(Number.NaN)),
      "CALLBACK_NOT_SERIALIZABLE",
    );
    expect(error.message).toContain("an instance of Date");
  });

  test("round-trips a BigInt exactly", () => {
    const c = codec();
    for (const value of [123n, -456n, 2n ** 100n, 0n]) {
      expect(c.decode<unknown>(c.encode(value))).toBe(value);
    }
  });

  test("round-trips the numbers JSON cannot represent, exactly", () => {
    const c = codec();
    expect(Number.isNaN(c.decode<unknown>(c.encode(Number.NaN)))).toBe(true);
    expect(c.decode<unknown>(c.encode(Number.POSITIVE_INFINITY))).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(c.decode<unknown>(c.encode(Number.NEGATIVE_INFINITY))).toBe(
      Number.NEGATIVE_INFINITY,
    );
    const negativeZero = c.decode<number>(c.encode(-0));
    expect(Object.is(negativeZero, -0)).toBe(true);
    // Ordinary numbers stay bare JSON.
    expect(c.encode(1.5)).toBe("1.5");
  });

  test("round-trips a Map, preserving insertion order and nested values", () => {
    const c = codec();
    const map = new Map<string, unknown>([
      ["admin", true],
      ["since", new Date(0)],
      ["count", 7n],
    ]);
    const decoded = c.decode<Map<string, unknown>>(c.encode(map));
    expect(decoded).toEqual(map);
    expect([...decoded.keys()]).toEqual(["admin", "since", "count"]);
    expect(decoded.get("since")).toEqual(new Date(0));
  });

  test("round-trips a Set, preserving insertion order", () => {
    const c = codec();
    const set = new Set(["admin", "ops", "admin"]);
    const decoded = c.decode<Set<string>>(c.encode(set));
    expect(decoded).toEqual(set);
    expect([...decoded]).toEqual(["admin", "ops"]);
  });

  test("round-trips a RegExp (lastIndex is documented loss)", () => {
    const c = codec();
    const pattern = /user-\d+/gi;
    const decoded = c.decode<RegExp>(c.encode(pattern));
    expect(decoded).toEqual(pattern);
    expect(decoded.source).toBe("user-\\d+");
    expect(decoded.flags).toBe("gi");
  });

  test("round-trips an Error's class, message, stack, and own enumerable properties", () => {
    const c = codec();
    const original = new Error("boom");
    const decoded = c.decode<Error>(c.encode(original));
    expect(decoded).toEqual(original);
    expect(decoded.message).toBe("boom");
    expect(decoded.name).toBe("Error");
    expect(typeof decoded.stack).toBe("string");

    // A custom name assigned on the instance is an own enumerable property:
    // `toEqual` compares it, so the codec must carry it.
    const named = new Error("not found");
    named.name = "HttpError";
    const decodedNamed = c.decode<Error>(c.encode(named));
    expect(decodedNamed).toEqual(named);
    expect(decodedNamed.name).toBe("HttpError");
    expect(decodedNamed.message).toBe("not found");

    // bun's `toEqual` compares the error class: a TypeError must come back one.
    const typeError = new TypeError("bad");
    expect(c.decode<unknown>(c.encode(typeError))).toEqual(typeError);

    // Own enumerable extras round-trip, and re-encode recursively.
    const withExtras = new Error("fs") as Error & {
      code: string;
      at: Date;
    };
    withExtras.code = "ENOENT";
    withExtras.at = new Date(0);
    const decodedExtras = c.decode<typeof withExtras>(c.encode(withExtras));
    expect(decodedExtras).toEqual(withExtras);
    expect(decodedExtras.code).toBe("ENOENT");
    expect(decodedExtras.at).toEqual(new Date(0));
  });

  test("round-trips typed arrays and ArrayBuffers byte for byte", () => {
    const c = codec();
    const bytes = new Uint8Array([1, 2, 255, 0]);
    expect(c.decode<unknown>(c.encode(bytes))).toEqual(bytes);

    const floats = new Float64Array([0.5, -1.25]);
    expect(c.decode<unknown>(c.encode(floats))).toEqual(floats);

    const bigints = new BigInt64Array([1n, -2n]);
    expect(c.decode<unknown>(c.encode(bigints))).toEqual(bigints);

    const buffer = new Uint8Array([9, 8, 7]).buffer;
    expect(c.decode<unknown>(c.encode(buffer))).toEqual(buffer);
  });

  test("refuses a DataView (no built-in claims it)", () => {
    const c = codec();
    expectCassetteError(
      () => c.encode(new DataView(new ArrayBuffer(2))),
      "CALLBACK_NOT_SERIALIZABLE",
    );
  });

  test("round-trips a composite of serializer-backed values", () => {
    const c = codec();
    const account = {
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      roles: new Map([["admin", true]]),
      tags: new Set(["a", "b"]),
      balance: 10n,
      pattern: /^user-\d+$/,
      checksum: new Uint8Array([1, 2, 3]),
      ratio: Number.NaN,
      history: [new Date(0), { at: new Date(1) }],
    };
    expect(c.decode<unknown>(c.encode(account))).toEqual(account);
  });
});

describe("callback codec: structure", () => {
  test("reconstructs repeated references as equal copies", () => {
    const c = codec();
    const shared = new Date(0);
    const decoded = c.decode<{ a: Date; b: Date }>(
      c.encode({ a: shared, b: shared }),
    );
    expect(decoded.a).toEqual(shared);
    expect(decoded.b).toEqual(shared);
    expect(decoded.a).not.toBe(decoded.b);
  });

  test("refuses a cycle through a Map where it closes", () => {
    const c = codec();
    const map = new Map<string, unknown>();
    map.set("self", map);
    const error = expectCassetteError(
      () => c.encode({ graph: map }),
      "CALLBACK_NOT_SERIALIZABLE",
    );
    expect(error.message).toContain("circular");
    expect(error.details).toMatchObject({ path: "$.graph[0][1]" });
  });

  test("still refuses nested undefined, functions, and symbols", () => {
    const c = codec();
    expectCassetteError(
      () => c.encode({ nickname: undefined }),
      "CALLBACK_NOT_SERIALIZABLE",
    );
    expectCassetteError(
      () => c.encode({ format: () => "ada" }),
      "CALLBACK_NOT_SERIALIZABLE",
    );
    expectCassetteError(
      () => c.encode({ [Symbol("secret")]: "hidden" }),
      "CALLBACK_NOT_SERIALIZABLE",
    );
  });
});

describe("callback codec: user serializers", () => {
  class Point {
    constructor(
      public x: number,
      public y: number,
    ) {}
  }

  const pointSerializer = defineCallbackSerializer<Point>({
    name: "point",
    version: 1,
    test: (value) => value instanceof Point,
    serialize: (value) => ({ x: value.x, y: value.y }),
    deserialize: (data) => {
      const { x, y } = data as { x: number; y: number };
      return new Point(x, y);
    },
  });

  test("round-trips a class instance through a registered serializer", () => {
    const c = codec();
    c.add(pointSerializer);
    const decoded = c.decode<unknown>(c.encode({ home: new Point(1, 2) }));
    expect(decoded).toEqual({ home: new Point(1, 2) });
    expect((decoded as { home: unknown }).home).toBeInstanceOf(Point);
  });

  test("refuses a class instance with no serializer, naming addSerializer", () => {
    const c = codec();
    const error = expectCassetteError(
      () => c.encode(new Point(1, 2)),
      "CALLBACK_NOT_SERIALIZABLE",
    );
    expect(error.message).toContain("addSerializer");
  });

  test("runs user serializers before built-ins, newest first", () => {
    const c = codec();
    const customDate = defineCallbackSerializer<Date>({
      name: "date",
      version: 2,
      test: (value) => value instanceof Date,
      serialize: (value) => ({ ms: value.getTime() }),
      deserialize: (data) => new Date((data as { ms: number }).ms),
    });
    c.add(customDate);

    const encoded = c.encode(new Date(1000));
    expect(encoded).toContain('"name":"date"');
    expect(encoded).toContain('"version":2');
    expect(encoded).toContain('"ms":1000');
    expect(c.decode<unknown>(encoded)).toEqual(new Date(1000));
  });

  test("decodes an older envelope when a newer registration shadows it", () => {
    const c = codec();
    // A recording made by the built-in date v1 before the shadow existed.
    const v1Envelope = JSON.stringify({
      [ENVELOPE_KEY]: {
        name: "date",
        version: 1,
        data: "1970-01-01T00:00:00.000Z",
      },
    });
    c.add(
      defineCallbackSerializer<Date>({
        name: "date",
        version: 2,
        test: (value) => value instanceof Date,
        serialize: (value) => value.getTime(),
        deserialize: (data) => new Date(data as number),
      }),
    );
    expect(c.decode<unknown>(v1Envelope)).toEqual(new Date(0));
  });

  test("reports a missing serializer with an actionable, coded error", () => {
    const c = codec();
    const stored = JSON.stringify({
      user: {
        [ENVELOPE_KEY]: { name: "money", version: 3, data: "10.00" },
      },
    });
    const error = expectCassetteError(
      () => c.decode<unknown>(stored),
      "CALLBACK_SERIALIZER_NOT_FOUND",
    );
    expect(error.message).toContain("money");
    expect(error.message).toContain("addSerializer");
    expect(error.details).toMatchObject({
      name: "money",
      version: 3,
      path: "$.user",
    });
    expect(error.details?.registered).toContain("date v1");
  });

  test("wraps a throwing serializer with code, phase, and cause", () => {
    for (const phase of ["test", "serialize"] as const) {
      const c = codec();
      const { error: boom, serializer } = throwingSerializer(phase);
      c.add(serializer);

      const encodeError = expectCassetteError(
        () => c.encode({ value: "text" }),
        "CALLBACK_SERIALIZER_FAILED",
      );
      expect(encodeError.details).toMatchObject({
        name: "thrower",
        phase,
        path: "$.value",
      });
      expect(encodeError.cause).toBe(boom);
    }
  });

  test("wraps a deserialize failure with its cause", () => {
    const c = codec();
    const { error: boom, serializer } = throwingSerializer("deserialize");
    c.add(serializer);
    const encoded = c.encode("text"); // test/serialize pass through
    const error = expectCassetteError(
      () => c.decode<unknown>(encoded),
      "CALLBACK_SERIALIZER_FAILED",
    );
    expect(error.details).toMatchObject({
      name: "thrower",
      phase: "deserialize",
    });
    expect(error.cause).toBe(boom);
  });

  test("refuses a serializer that re-claims its own output", () => {
    const c = codec();
    c.add(
      defineCallbackSerializer<string>({
        name: "loop",
        version: 1,
        test: (value) => typeof value === "string",
        serialize: (value) => `${value}!`,
        deserialize: (data) => data as string,
      }),
    );
    const error = expectCassetteError(
      () => c.encode("text"),
      "CALLBACK_SERIALIZER_FAILED",
    );
    expect(error.message).toContain("still claims");
    expect(error.details).toMatchObject({ name: "loop", phase: "serialize" });
  });

  test("refuses a serializer that re-claims values nested in its output, at the depth bound", () => {
    const c = codec();
    c.add(
      defineCallbackSerializer<string>({
        name: "fractal",
        version: 1,
        test: (value) => typeof value === "string" && value.startsWith("s"),
        serialize: (value) => ({ next: `s${value}` }),
        deserialize: (data) => (data as { next: string }).next,
      }),
    );
    // "seed" is claimed; the output's "sseed" is claimed again, forever.
    // The walk is bounded, so this is a coded refusal, not a stack overflow.
    const error = expectCassetteError(
      () => c.encode("seed"),
      "CALLBACK_NOT_SERIALIZABLE",
    );
    expect(error.message).toContain("deeper than");
  });

  test("validates the serializer shape at add time", () => {
    const c = codec();
    const broken: unknown[] = [
      null,
      "date",
      [],
      {
        name: "",
        version: 1,
        test: () => true,
        serialize: () => 1,
        deserialize: () => 1,
      },
      {
        name: 5,
        version: 1,
        test: () => true,
        serialize: () => 1,
        deserialize: () => 1,
      },
      {
        name: "x",
        version: 0,
        test: () => true,
        serialize: () => 1,
        deserialize: () => 1,
      },
      {
        name: "x",
        version: 1.5,
        test: () => true,
        serialize: () => 1,
        deserialize: () => 1,
      },
      { name: "x", version: 1, serialize: () => 1, deserialize: () => 1 },
      { name: "x", version: 1, test: () => true, deserialize: () => 1 },
      { name: "x", version: 1, test: () => true, serialize: () => 1 },
    ];
    for (const serializer of broken) {
      expectCassetteError(
        () => c.add(serializer as CallbackSerializer),
        "INVALID_API_USAGE",
      );
    }
  });
});
