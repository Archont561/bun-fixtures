import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  BunTestUtilsError,
  createFixture,
  slugifyFilename,
} from "@bun-test-utils/core";

/**
 * - `"match"` (default outside CI): compare against the stored value; a
 *   missing snapshot is recorded instead of failing (first-run behaviour).
 * - `"update"`: (re)write every snapshot touched during the test,
 *   regardless of what was stored before.
 * - `"ci"`: never create a snapshot — a missing or mismatched entry fails
 *   the test. Automatically selected when `process.env.CI` is set, unless
 *   `SNAPSHOT_MODE` says otherwise.
 */
export type SnapshotMode = "match" | "update" | "ci";

/**
 * Turns `value` into its comparable string form, or returns `undefined` to
 * fall through to the next serializer (built-ins run last).
 */
export type Serializer = (value: unknown) => string | undefined;

interface SnapshotSerializationContext {
  snapshotName: string;
  snapshotPath: string;
}

class SnapshotSerializationError extends BunTestUtilsError {
  constructor(
    code: "SNAPSHOT_CIRCULAR_REFERENCE" | "SNAPSHOT_SERIALIZER_FAILED",
    message: string,
    details: Record<string, unknown>,
    cause?: unknown,
  ) {
    super(code, message, { cause, details });
    this.name = "SnapshotSerializationError";
  }
}

function describeThrownValue(value: unknown): string {
  try {
    if (value instanceof Error) return value.message || value.name;
    return String(value);
  } catch {
    return "<unprintable thrown value>";
  }
}

const GLOBAL_SERIALIZERS = Symbol.for("bun-test-utils.snapshotSerializers");
const globalSerializers = ((globalThis as Record<symbol, unknown>)[
  GLOBAL_SERIALIZERS
] ??= []) as Serializer[];

/** Registers a serializer for every snapshot fixture in this process. */
export function registerSnapshotSerializer(serializer: Serializer): Serializer {
  globalSerializers.unshift(serializer);
  return serializer;
}

/**
 * Unregisters every registration of this exact serializer function.
 * Returns `true` when at least one registration was removed.
 */
export function unregisterSnapshotSerializer(serializer: Serializer): boolean {
  let removed = false;
  for (let index = globalSerializers.length - 1; index >= 0; index -= 1) {
    if (globalSerializers[index] === serializer) {
      globalSerializers.splice(index, 1);
      removed = true;
    }
  }
  return removed;
}

/** Removes every globally registered serializer in this Bun process. */
export function resetSnapshotSerializers(): void {
  // Keep the shared array identity: the root entrypoint and `/snap` may each
  // bundle this module, but both observe the same Symbol.for-backed registry.
  globalSerializers.length = 0;
}

/** Creates and globally registers a reusable snapshot serializer. */
export function createSnapshotSerializer(serializer: Serializer): Serializer {
  return registerSnapshotSerializer(serializer);
}

export interface SnapshotHelper {
  mode: SnapshotMode;
  setMode(mode: SnapshotMode): void;
  /** Registered serializers run before the built-ins, most recent first. */
  addSerializer(serializer: Serializer): void;
  /**
   * The conventional snapshot file for the current test:
   * `__snapshots__/<test-name>.snap.json` next to the test file.
   */
  path: string;
  /**
   * Serializes `value` and compares it against the stored snapshot named
   * `name` (or an auto-numbered `"value"` / `"value 2"` / ... key when
   * omitted). Throws on mismatch; records a new entry on first run unless
   * `mode` is `"ci"`.
   */
  match(value: unknown, name?: string): void;
  /** Same as `match`, but reads the actual value from a file on disk. */
  matchFile(filePath: string, name?: string): void;
}

/** Recursively sorts object keys so serialization doesn't depend on insertion order. */
function sortKeysDeep(
  value: unknown,
  serializeCustom: (value: unknown, path: string) => string | undefined,
  path: string,
  ancestors: Map<object, string>,
  context: SnapshotSerializationContext,
  applyCustom = true,
): unknown {
  if (applyCustom) {
    const custom = serializeCustom(value, path);
    if (custom !== undefined) return custom;
  }
  if (value instanceof Error) return `${value.name}: ${value.message}`;

  if (
    value !== null &&
    typeof value === "object" &&
    !(value instanceof Date) &&
    !(value instanceof RegExp)
  ) {
    const firstSeenAt = ancestors.get(value);
    if (firstSeenAt !== undefined) {
      throw new SnapshotSerializationError(
        "SNAPSHOT_CIRCULAR_REFERENCE",
        `[bun-test-utils/snapshot] Circular reference at ${path} (first seen at ${firstSeenAt}) while serializing snapshot ${JSON.stringify(context.snapshotName)} in ${context.snapshotPath}.`,
        {
          snapshotName: context.snapshotName,
          snapshotPath: context.snapshotPath,
          valuePath: path,
          firstSeenAt,
        },
      );
    }

    ancestors.set(value, path);
    try {
      if (Array.isArray(value)) {
        return value.map((item, index) =>
          sortKeysDeep(
            item,
            serializeCustom,
            `${path}[${index}]`,
            ancestors,
            context,
          ),
        );
      }

      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(value).sort()) {
        const childPath = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
          ? `${path}.${key}`
          : `${path}[${JSON.stringify(key)}]`;
        sorted[key] = sortKeysDeep(
          (value as Record<string, unknown>)[key],
          serializeCustom,
          childPath,
          ancestors,
          context,
        );
      }
      return sorted;
    } finally {
      ancestors.delete(value);
    }
  }

  return value;
}

function resolveMode(): SnapshotMode {
  const env = process.env.SNAPSHOT_MODE;
  if (env === "match" || env === "update" || env === "ci") return env;
  return process.env.CI ? "ci" : "match";
}

export const snapshotFixture = createFixture<SnapshotHelper>({
  scope: "test",
  setup: async (use, ctx) => {
    let mode = resolveMode();
    const serializers: Serializer[] = [];
    const counters = new Map<string, number>();

    // Convention: `<test dir>/__snapshots__/<test name>.snap.json` — mirrors
    // @bun-test-utils/vcr's `__cassettes__` convention. Commit this file;
    // reviewing its diff *is* the review of a snapshot change.
    const snapshotPath = join(
      dirname(ctx.testFile),
      "__snapshots__",
      `${slugifyFilename(ctx.testName ?? "snapshot", "snapshot")}.snap.json`,
    );

    const stored: Record<string, string> = existsSync(snapshotPath)
      ? JSON.parse(readFileSync(snapshotPath, "utf8"))
      : {};
    let dirty = false;

    function customSerialize(
      value: unknown,
      valuePath: string,
      context: SnapshotSerializationContext,
    ): string | undefined {
      for (const serializer of [...serializers, ...globalSerializers]) {
        try {
          const result = serializer(value);
          if (result !== undefined) return result;
        } catch (cause) {
          throw new SnapshotSerializationError(
            "SNAPSHOT_SERIALIZER_FAILED",
            `[bun-test-utils/snapshot] Serializer failed at ${valuePath} while serializing snapshot ${JSON.stringify(context.snapshotName)} in ${context.snapshotPath}: ${describeThrownValue(cause)}`,
            {
              snapshotName: context.snapshotName,
              snapshotPath: context.snapshotPath,
              valuePath,
            },
            cause,
          );
        }
      }
      return undefined;
    }

    function serialize(value: unknown, snapshotName: string): string {
      const context = { snapshotName, snapshotPath };
      const custom = customSerialize(value, "$", context);
      if (custom !== undefined) return custom;
      if (typeof value === "string") return value;
      if (value instanceof Error) return `${value.name}: ${value.message}`;

      const stringify = (input: unknown) =>
        JSON.stringify(
          input,
          (_key, nested) =>
            typeof nested === "bigint" ? `${nested.toString()}n` : nested,
          2,
        );

      if (typeof value === "object" && value !== null) {
        try {
          return (
            stringify(
              sortKeysDeep(
                value,
                (nested, valuePath) =>
                  customSerialize(nested, valuePath, context),
                "$",
                new Map(),
                context,
                false,
              ),
            ) ?? String(value)
          );
        } catch (error) {
          if (error instanceof SnapshotSerializationError) throw error;
          return String(value);
        }
      }

      try {
        return stringify(value) ?? String(value);
      } catch {
        return String(value);
      }
    }

    function nextKey(name?: string): string {
      if (name) return name;
      const n = (counters.get("value") ?? 0) + 1;
      counters.set("value", n);
      return n === 1 ? "value" : `value ${n}`;
    }

    function compare(key: string, actual: string): void {
      const existing = stored[key];
      if (existing === undefined) {
        if (mode === "ci") {
          throw new Error(
            `[bun-test-utils/snapshot] No stored snapshot "${key}" in ${snapshotPath} ` +
              `(mode=ci never creates new snapshots). Run once without ` +
              "SNAPSHOT_MODE=ci / CI to record it, then commit the file.",
          );
        }
        stored[key] = actual;
        dirty = true;
        return;
      }
      if (mode === "update") {
        if (existing !== actual) dirty = true;
        stored[key] = actual;
        return;
      }
      if (existing !== actual) {
        throw new Error(
          `[bun-test-utils/snapshot] Snapshot "${key}" mismatch in ${snapshotPath}.\n\n` +
            `--- stored ---\n${existing}\n\n--- received ---\n${actual}\n\n` +
            "Run with SNAPSHOT_MODE=update to accept the new value.",
        );
      }
    }

    const helper: SnapshotHelper = {
      get mode() {
        return mode;
      },
      get path() {
        return snapshotPath;
      },
      setMode(m: SnapshotMode) {
        mode = m;
      },
      addSerializer(serializer: Serializer) {
        serializers.unshift(serializer);
      },
      match(value, name) {
        const key = nextKey(name);
        compare(key, serialize(value, key));
      },
      matchFile(filePath, name) {
        if (!existsSync(filePath)) {
          throw new Error(
            `[bun-test-utils/snapshot] File not found: ${filePath}`,
          );
        }
        compare(nextKey(name), readFileSync(filePath, "utf8"));
      },
    };

    try {
      await use(helper);
    } finally {
      if (dirty) {
        mkdirSync(dirname(snapshotPath), { recursive: true });
        writeFileSync(
          snapshotPath,
          `${JSON.stringify(stored, null, 2)}\n`,
          "utf8",
        );
      }
    }
  },
});
