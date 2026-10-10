/**
 * Reversible, versioned serializers for cassette callback values (ADR 0034).
 *
 * `record` encodes a callback result to the text the registry stores;
 * `replay` decodes that text back to a structural reconstruction. A value is
 * encoded by the first serializer that claims it — fixture-local registrations
 * run newest-first, then process-wide registrations newest-first, then the
 * built-ins — and every other value must be plain data or is refused as in ADR
 * 0026. A serialized position holds a
 * `{ "__bunTestUtils": { name, version, data } }` envelope inside the
 * otherwise plain JSON payload, so encoded values are self-describing and
 * versionable; plain data encodes byte-identically to `JSON.stringify`.
 */
import { Buffer } from "node:buffer";
import { CassetteError } from "@bun-test-utils/core";

/** A reversible, versioned encoding for one shape of callback value. */
export interface CallbackSerializer<T = unknown> {
  /** Stable id recorded in the encoded payload, e.g. `"date"`. */
  readonly name: string;
  /** Encoding version recorded in the payload; an integer ≥ 1. */
  readonly version: number;
  /** True when this serializer takes responsibility for encoding `value`. */
  test(value: unknown): boolean;
  /**
   * Encodes `value` to data the codec re-encodes recursively, so a `Map` of
   * `Date`s needs no special handling. The output must not be claimed by
   * this same serializer: encoding has to move toward plain data.
   */
  serialize(value: T): unknown;
  /** Reconstructs the value from fully decoded data. */
  deserialize(data: unknown): T;
}

/**
 * Shared by the root plugin bundle and the public `/vcr` bundle, so a preload
 * registration reaches every cassette codec in this Bun process (ADR 0040).
 */
const GLOBAL_CALLBACK_SERIALIZERS = Symbol.for(
  "bun-test-utils.vcrCallbackSerializers",
);
const globalCallbackSerializers = ((globalThis as Record<symbol, unknown>)[
  GLOBAL_CALLBACK_SERIALIZERS
] ??= []) as CallbackSerializer<unknown>[];

/**
 * Registers a serializer for every cassette created in this Bun process.
 * Fixture-local `cassette.addSerializer` registrations still run first.
 */
export function registerCallbackSerializer<T>(
  serializer: CallbackSerializer<T>,
): CallbackSerializer<T> {
  validateSerializer(serializer, "registerCallbackSerializer");
  globalCallbackSerializers.unshift(serializer as CallbackSerializer<unknown>);
  return serializer;
}

/**
 * Unregisters every registration of this exact serializer object. Returns true
 * when at least one registration was removed (ADR 0040).
 */
export function unregisterCallbackSerializer<T>(
  serializer: CallbackSerializer<T>,
): boolean {
  const target = serializer as CallbackSerializer<unknown>;
  let removed = false;
  for (
    let index = globalCallbackSerializers.length - 1;
    index >= 0;
    index -= 1
  ) {
    if (globalCallbackSerializers[index] === target) {
      globalCallbackSerializers.splice(index, 1);
      removed = true;
    }
  }
  return removed;
}

/**
 * Identity wrapper giving reusable serializer definitions contextual typing,
 * following the `define*` convention of ADR 0023. Exported from the public
 * `@archont561/bun-test-utils/vcr` subpath.
 */
export function defineCallbackSerializer<T>(
  serializer: CallbackSerializer<T>,
): CallbackSerializer<T> {
  return serializer;
}

/**
 * The reserved object key holding a serializer envelope. Part of the wire
 * format and pinned literally by tests; plain data using it as an own key is
 * refused, which keeps the encoding injective.
 */
export const ENVELOPE_KEY = "__bunTestUtils";

/** The stored text for a top-level `undefined`, predating serializers. */
const UNDEFINED_SENTINEL = "__undefined__";

/**
 * Bound on the encode walk. Legitimate API payloads never approach it; a
 * serializer that re-claims values nested inside its own output would
 * recurse forever without it, so exceeding it is a coded refusal instead of
 * a stack overflow.
 */
const MAX_ENCODE_DEPTH = 512;

const REFUSAL_HINT =
  "Return plain data (null, booleans, strings, finite numbers, arrays, plain objects), convert inside the callback, or teach the cassette the type with cassette.addSerializer(...) — see defineCallbackSerializer in @archont561/bun-test-utils/vcr.";

/** Extends a diagnostic path, quoting keys that are not plain identifiers. */
function childPath(parent: string, key: string | number): string {
  if (typeof key === "number") return `${parent}[${key}]`;
  return /^[A-Za-z_$][\w$]*$/.test(key)
    ? `${parent}.${key}`
    : `${parent}[${JSON.stringify(key)}]`;
}

/** Names a non-plain object for a diagnostic. */
function describeObject(value: object): string {
  const name = (value as { constructor?: { name?: unknown } }).constructor
    ?.name;
  return typeof name === "string" && name !== "" && name !== "Object"
    ? `an instance of ${name}`
    : "an object with a non-plain prototype";
}

function describeThrown(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

/** Throws the coded refusal for a value at `path` that nothing can encode. */
function refuse(
  path: string,
  valueType: string,
  hint = REFUSAL_HINT,
  details: Record<string, unknown> = {},
): never {
  const where = path === "$" ? "" : ` at ${path}`;
  throw new CassetteError(
    "CALLBACK_NOT_SERIALIZABLE",
    `[bun-test-utils/vcr] cassette callback returned ${valueType}${where}, which cannot round-trip through JSON. ${hint}`,
    { path, valueType, ...details },
  );
}

/** Throws the coded wrapper for a serializer hook that failed at `path`. */
function serializerFailed(
  serializer: CallbackSerializer<unknown>,
  path: string,
  phase: "test" | "serialize" | "deserialize",
  cause: unknown,
): never {
  throw new CassetteError(
    "CALLBACK_SERIALIZER_FAILED",
    `[bun-test-utils/vcr] The "${serializer.name}" v${serializer.version} serializer failed during ${phase} at ${path}: ${describeThrown(cause)}`,
    { name: serializer.name, version: serializer.version, phase, path },
    cause,
  );
}

/* -------------------------------------------------------------------------- */
/* Built-in serializers, all version 1 (ADR 0034)                             */
/* -------------------------------------------------------------------------- */

const dateSerializer: CallbackSerializer<Date> = {
  name: "date",
  version: 1,
  test: (value) => value instanceof Date && !Number.isNaN(value.getTime()),
  serialize: (value) => value.toISOString(),
  deserialize: (data) => new Date(data as string),
};

const bigintSerializer: CallbackSerializer<bigint> = {
  name: "bigint",
  version: 1,
  test: (value) => typeof value === "bigint",
  serialize: (value) => value.toString(),
  deserialize: (data) => BigInt(data as string),
};

const numberSerializer: CallbackSerializer<number> = {
  name: "number",
  version: 1,
  test: (value) =>
    typeof value === "number" &&
    (Number.isNaN(value) || !Number.isFinite(value) || Object.is(value, -0)),
  serialize: (value) => {
    if (Number.isNaN(value)) return "NaN";
    if (value === Number.POSITIVE_INFINITY) return "Infinity";
    if (value === Number.NEGATIVE_INFINITY) return "-Infinity";
    return "-0";
  },
  deserialize: (data) => {
    switch (data) {
      case "NaN":
        return Number.NaN;
      case "Infinity":
        return Number.POSITIVE_INFINITY;
      case "-Infinity":
        return Number.NEGATIVE_INFINITY;
      case "-0":
        return -0;
      default:
        throw new Error(`unknown number token: ${String(data)}`);
    }
  },
};

const mapSerializer: CallbackSerializer<Map<unknown, unknown>> = {
  name: "map",
  version: 1,
  test: (value) => value instanceof Map,
  serialize: (value) => Array.from(value.entries()),
  deserialize: (data) => new Map(data as [unknown, unknown][]),
};

const setSerializer: CallbackSerializer<Set<unknown>> = {
  name: "set",
  version: 1,
  test: (value) => value instanceof Set,
  serialize: (value) => Array.from(value),
  deserialize: (data) => new Set(data as unknown[]),
};

const regexpSerializer: CallbackSerializer<RegExp> = {
  name: "regexp",
  version: 1,
  test: (value) => value instanceof RegExp,
  serialize: (value) => ({ source: value.source, flags: value.flags }),
  deserialize: (data) => {
    const { source, flags } = data as { source: string; flags: string };
    return new RegExp(source, flags);
  },
};

/**
 * The global error constructors the built-in can rebuild. `bun:test`'s
 * `toEqual` compares the error class, so a `TypeError` only round-trips when
 * reconstructed as one; unknown subclasses reconstruct as `Error` (a
 * documented loss).
 */
const ERROR_CONSTRUCTORS: Record<string, new (message?: string) => Error> = {
  Error,
  TypeError,
  RangeError,
  SyntaxError,
  ReferenceError,
  EvalError,
  URIError,
};

interface ErrorPayload {
  /** The whitelisted constructor name; absent means a plain `Error`. */
  ctor?: string;
  message: string;
  stack?: string;
  properties?: [string, unknown][];
}

const errorSerializer: CallbackSerializer<Error> = {
  name: "error",
  version: 1,
  test: (value) => value instanceof Error,
  serialize: (value) => {
    const payload: ErrorPayload = { message: value.message };
    const ctorName = (value.constructor as { name?: unknown } | undefined)
      ?.name;
    if (
      typeof ctorName === "string" &&
      Object.hasOwn(ERROR_CONSTRUCTORS, ctorName)
    )
      payload.ctor = ctorName;
    if (typeof value.stack === "string") payload.stack = value.stack;
    // Own enumerable properties are what `toEqual` compares besides the
    // class and message; they re-encode recursively, so an error can carry
    // Dates, Maps, or other serializer-backed values.
    const properties = Object.entries(value);
    if (properties.length > 0) payload.properties = properties;
    return payload;
  },
  deserialize: (data) => {
    const payload = data as ErrorPayload;
    const ErrorCtor =
      (payload.ctor !== undefined && ERROR_CONSTRUCTORS[payload.ctor]) || Error;
    const error = new ErrorCtor(payload.message);
    if (typeof payload.stack === "string") error.stack = payload.stack;
    for (const [key, value] of payload.properties ?? [])
      (error as unknown as Record<string, unknown>)[key] = value;
    return error;
  },
};

const TYPED_ARRAY_CONSTRUCTORS = [
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
  BigInt64Array,
  BigUint64Array,
] as const;

type AnyTypedArray = InstanceType<(typeof TYPED_ARRAY_CONSTRUCTORS)[number]>;

const typedArrayByName = new Map<string, unknown>(
  TYPED_ARRAY_CONSTRUCTORS.map((ctor) => [ctor.name, ctor as unknown]),
);

interface TypedArrayPayload {
  ctor: string;
  base64: string;
}

/** Copies base64 bytes into an exactly sized ArrayBuffer. */
function bufferFromBase64(base64: string): ArrayBuffer {
  const bytes = Buffer.from(base64, "base64");
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

const typedArraySerializer: CallbackSerializer<AnyTypedArray> = {
  name: "typed-array",
  version: 1,
  test: (value) => {
    if (typeof value !== "object" || value === null) return false;
    // Exact constructors only: a subclass falls through to the refusal.
    const ctor = (value as { constructor?: unknown }).constructor;
    return (
      typeof ctor === "function" &&
      typedArrayByName.get((ctor as { name: string }).name) === ctor
    );
  },
  serialize: (value) =>
    ({
      ctor: value.constructor.name,
      base64: Buffer.from(
        value.buffer,
        value.byteOffset,
        value.byteLength,
      ).toString("base64"),
    }) satisfies TypedArrayPayload,
  deserialize: (data) => {
    const payload = data as TypedArrayPayload;
    const TypedArrayCtor = typedArrayByName.get(payload.ctor) as
      | (new (
          buffer: ArrayBuffer,
        ) => AnyTypedArray)
      | undefined;
    if (!TypedArrayCtor)
      throw new Error(
        `unknown typed array constructor: ${String(payload.ctor)}`,
      );
    return new TypedArrayCtor(bufferFromBase64(payload.base64));
  },
};

const arrayBufferSerializer: CallbackSerializer<ArrayBuffer> = {
  name: "array-buffer",
  version: 1,
  test: (value) => value instanceof ArrayBuffer,
  serialize: (value) => Buffer.from(value).toString("base64"),
  deserialize: (data) => bufferFromBase64(data as string),
};

/** Fixed order; the built-ins claim disjoint shapes, so order is stability. */
const BUILT_IN_SERIALIZERS: readonly CallbackSerializer<unknown>[] = [
  dateSerializer,
  bigintSerializer,
  numberSerializer,
  mapSerializer,
  setSerializer,
  regexpSerializer,
  errorSerializer,
  typedArraySerializer,
  arrayBufferSerializer,
] as CallbackSerializer<unknown>[];

/* -------------------------------------------------------------------------- */
/* The codec                                                                  */
/* -------------------------------------------------------------------------- */

/** The provisional engine behind `cassette.addSerializer`/`record`/`replay`. */
export interface SerializerCodec {
  /** Validates and registers a user serializer; newest runs first. */
  add<T>(serializer: CallbackSerializer<T>): void;
  /** Encodes a callback result to the stored text. Throws coded refusals. */
  encode(value: unknown): string;
  /** Decodes stored text back to a structural reconstruction. */
  decode<T>(serialized: string): T;
}

/** Throws unless `serializer` has the shape the codec can run. */
function validateSerializer(
  candidate: unknown,
  registration = "cassette.addSerializer",
): asserts candidate is CallbackSerializer<unknown> {
  const invalid = (reason: string): never => {
    throw new CassetteError(
      "INVALID_API_USAGE",
      `[bun-test-utils/vcr] ${registration} requires { name: non-empty string, version: integer >= 1, test(value), serialize(value), deserialize(data) } — ${reason}.`,
      { reason },
    );
  };
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    Array.isArray(candidate)
  )
    invalid(`received ${candidate === null ? "null" : typeof candidate}`);
  const serializer = candidate as Partial<CallbackSerializer<unknown>>;
  if (typeof serializer.name !== "string" || serializer.name.length === 0)
    invalid("name must be a non-empty string");
  if (
    !Number.isInteger(serializer.version) ||
    (serializer.version as number) < 1
  )
    invalid("version must be an integer >= 1");
  if (typeof serializer.test !== "function") invalid("test must be a function");
  if (typeof serializer.serialize !== "function")
    invalid("serialize must be a function");
  if (typeof serializer.deserialize !== "function")
    invalid("deserialize must be a function");
}

export function createSerializerCodec(): SerializerCodec {
  /** Fixture-local registrations, newest first, ahead of process globals. */
  const userSerializers: CallbackSerializer<unknown>[] = [];
  /** Resolve on each use so preload/global lifecycle changes stay visible. */
  const ordered = (): CallbackSerializer<unknown>[] => [
    ...userSerializers,
    ...globalCallbackSerializers,
    ...BUILT_IN_SERIALIZERS,
  ];

  /**
   * Encodes one value. `ancestors` maps each object on the current path to
   * where it was first seen, so a cycle is refused where it closes. `skip`
   * excludes one serializer from this call's dispatch only, and
   * `MAX_ENCODE_DEPTH` bounds the walk, so a serializer that re-claims
   * values nested inside its own output is refused instead of recursing
   * forever.
   */
  function encodeValue(
    value: unknown,
    path: string,
    ancestors: Map<object, string>,
    skip: CallbackSerializer<unknown> | undefined,
    depth = 0,
  ): unknown {
    if (depth > MAX_ENCODE_DEPTH)
      refuse(
        path,
        `a structure nested deeper than ${MAX_ENCODE_DEPTH} levels`,
        "The value may be unbounded, or a serializer may re-claim values it produces. Return a bounded tree.",
      );
    for (const serializer of ordered()) {
      if (serializer === skip) continue;
      let claimed = false;
      try {
        claimed = serializer.test(value);
      } catch (cause) {
        serializerFailed(serializer, path, "test", cause);
      }
      if (!claimed) continue;

      const isObject = typeof value === "object" && value !== null;
      if (isObject) {
        const seen = ancestors.get(value as object);
        if (seen !== undefined)
          refuse(
            path,
            "a circular structure",
            `The same object is already at ${seen}. Return a tree without cycles.`,
            { firstSeenAt: seen },
          );
      }

      let data: unknown;
      try {
        data = serializer.serialize(value as never);
      } catch (cause) {
        serializerFailed(serializer, path, "serialize", cause);
      }
      let reclaims = false;
      try {
        reclaims = serializer.test(data);
      } catch (cause) {
        serializerFailed(serializer, path, "test", cause);
      }
      if (reclaims)
        serializerFailed(
          serializer,
          path,
          "serialize",
          new Error(
            "serialize() returned a value the same serializer still claims; encoding must move toward plain data",
          ),
        );

      if (isObject) ancestors.set(value as object, path);
      const encodedData = encodeValue(
        data,
        path,
        ancestors,
        serializer,
        depth + 1,
      );
      if (isObject) ancestors.delete(value as object);
      return {
        [ENVELOPE_KEY]: {
          name: serializer.name,
          version: serializer.version,
          data: encodedData,
        },
      };
    }

    // Plain data: the only shape nothing claimed and JSON represents exactly.
    // The number/bigint refusals below are defensive: the built-in
    // serializers claim every such value before this point.
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean"
    )
      return value;
    if (typeof value === "number") {
      if (Number.isNaN(value)) refuse(path, "NaN");
      if (!Number.isFinite(value))
        refuse(path, value > 0 ? "Infinity" : "-Infinity");
      if (Object.is(value, -0)) refuse(path, "-0");
      return value;
    }
    if (value === undefined)
      refuse(
        path,
        "undefined",
        "Remove it, return null instead, or register a serializer that claims it.",
      );
    if (typeof value === "bigint") refuse(path, "a BigInt");
    if (typeof value === "function") refuse(path, "a function");
    if (typeof value === "symbol") refuse(path, "a symbol");

    const object = value as object;
    const firstSeenAt = ancestors.get(object);
    if (firstSeenAt !== undefined)
      refuse(
        path,
        "a circular structure",
        `The same object is already at ${firstSeenAt}. Return a tree without cycles.`,
        { firstSeenAt },
      );

    if (Array.isArray(object)) {
      if (Object.getPrototypeOf(object) !== Array.prototype)
        refuse(path, describeObject(object));
      // Exactly the indices and `length`: a hole or an extra property fails this.
      if (Reflect.ownKeys(object).length !== object.length + 1)
        refuse(path, "a sparse array or an array with extra properties");
      ancestors.set(object, path);
      const items: unknown[] = [];
      for (let index = 0; index < object.length; index++)
        items.push(
          encodeValue(
            object[index],
            childPath(path, index),
            ancestors,
            undefined,
            depth + 1,
          ),
        );
      ancestors.delete(object);
      return items;
    }

    const prototype = Object.getPrototypeOf(object);
    if (prototype !== Object.prototype && prototype !== null)
      refuse(path, describeObject(object));
    const keys = Object.keys(object);
    if (Reflect.ownKeys(object).length !== keys.length)
      refuse(path, "an object with symbol-keyed or non-enumerable properties");
    if (keys.includes(ENVELOPE_KEY))
      refuse(
        path,
        `an object using the reserved key "${ENVELOPE_KEY}"`,
        "Rename the property: the key is reserved for serializer envelopes.",
      );
    ancestors.set(object, path);
    const encoded: Record<string, unknown> = {};
    for (const key of keys)
      encoded[key] = encodeValue(
        (object as Record<string, unknown>)[key],
        childPath(path, key),
        ancestors,
        undefined,
        depth + 1,
      );
    ancestors.delete(object);
    return encoded;
  }

  /** Decodes one stored value; envelopes resolve through exact (name, version). */
  function decodeValue(data: unknown, path: string): unknown {
    if (Array.isArray(data))
      return data.map((item, index) =>
        decodeValue(item, childPath(path, index)),
      );
    if (data !== null && typeof data === "object") {
      const object = data as Record<string, unknown>;
      if (Object.hasOwn(object, ENVELOPE_KEY)) {
        const envelope = object[ENVELOPE_KEY] as Partial<{
          name: unknown;
          version: unknown;
          data: unknown;
        }> | null;
        if (
          envelope === null ||
          typeof envelope !== "object" ||
          typeof envelope.name !== "string" ||
          typeof envelope.version !== "number" ||
          !Object.hasOwn(envelope, "data")
        ) {
          throw new CassetteError(
            "CALLBACK_SERIALIZER_NOT_FOUND",
            `[bun-test-utils/vcr] The recorded value at ${path} holds an unreadable serializer envelope. Re-record the callback.`,
            { path },
          );
        }
        const { name, version } = envelope;
        const serializers = ordered();
        const serializer = serializers.find(
          (candidate) =>
            candidate.name === name && candidate.version === version,
        );
        if (!serializer) {
          const registered = serializers.map((s) => `${s.name} v${s.version}`);
          throw new CassetteError(
            "CALLBACK_SERIALIZER_NOT_FOUND",
            `[bun-test-utils/vcr] The recorded value at ${path} was encoded by serializer "${name}" v${version}, which is not registered (registered: ${registered.join(", ")}). ` +
              "Register it with cassette.addSerializer(...) or registerCallbackSerializer(...) before replay, or re-record the callback.",
            { name, version, path, registered },
          );
        }
        const decodedData = decodeValue(envelope.data, path);
        try {
          return serializer.deserialize(decodedData);
        } catch (cause) {
          serializerFailed(serializer, path, "deserialize", cause);
        }
      }
      const decoded: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(object))
        decoded[key] = decodeValue(value, childPath(path, key));
      return decoded;
    }
    return data;
  }

  return {
    add<T>(serializer: CallbackSerializer<T>): void {
      validateSerializer(serializer);
      userSerializers.unshift(serializer as CallbackSerializer<unknown>);
    },

    encode(value: unknown): string {
      if (value === undefined) return UNDEFINED_SENTINEL;
      const encoded = encodeValue(value, "$", new Map(), undefined);
      try {
        return JSON.stringify(encoded);
      } catch (cause) {
        // Unreachable: encodeValue only produces JSON-safe data. Kept so an
        // unexpected failure still carries the code and the prefix.
        throw new CassetteError(
          "CALLBACK_NOT_SERIALIZABLE",
          `[bun-test-utils/vcr] cassette callback returned a value that cannot be serialized: ${describeThrown(cause)}`,
          { path: "$" },
          cause,
        );
      }
    },

    decode<T>(serialized: string): T {
      if (serialized === UNDEFINED_SENTINEL) return undefined as T;
      return decodeValue(JSON.parse(serialized), "$") as T;
    },
  };
}
