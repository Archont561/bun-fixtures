import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createFixture, slugifyFilename } from "@bun-test-utils/core";

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
  serializeCustom?: (value: unknown) => string | undefined,
): unknown {
  const custom = serializeCustom?.(value);
  if (custom !== undefined) return custom;
  if (Array.isArray(value))
    return value.map((item) => sortKeysDeep(item, serializeCustom));
  if (
    value !== null &&
    typeof value === "object" &&
    !(value instanceof Date) &&
    !(value instanceof RegExp)
  ) {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeysDeep(
        (value as Record<string, unknown>)[key],
        serializeCustom,
      );
    }
    return sorted;
  }
  return value;
}

const BUILTIN_SERIALIZERS: Serializer[] = [
  (value) => (typeof value === "string" ? value : undefined),
  (value) =>
    value instanceof Error ? `${value.name}: ${value.message}` : undefined,
  (value) => {
    try {
      return JSON.stringify(
        sortKeysDeep(value),
        (_key, v) => (typeof v === "bigint" ? `${v.toString()}n` : v),
        2,
      );
    } catch {
      return undefined;
    }
  },
  (value) => String(value),
];

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

    function customSerialize(value: unknown): string | undefined {
      for (const serializer of [...serializers, ...globalSerializers]) {
        const result = serializer(value);
        if (result !== undefined) return result;
      }
      return undefined;
    }

    function serialize(value: unknown): string {
      const custom = customSerialize(value);
      if (custom !== undefined) return custom;

      for (const serializer of BUILTIN_SERIALIZERS.slice(0, 2)) {
        const result = serializer(value);
        if (result !== undefined) return result;
      }
      if (typeof value === "object" && value !== null) {
        try {
          return JSON.stringify(
            sortKeysDeep(value, customSerialize),
            (_key, nested) =>
              typeof nested === "bigint" ? `${nested}n` : nested,
            2,
          );
        } catch {
          return String(value);
        }
      }
      for (const serializer of BUILTIN_SERIALIZERS.slice(2)) {
        const result = serializer(value);
        if (result !== undefined) return result;
      }
      return String(value);
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
        compare(nextKey(name), serialize(value));
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
