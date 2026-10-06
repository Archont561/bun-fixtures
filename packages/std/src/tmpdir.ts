import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir as osTmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { createFixture } from "@bun-test-utils/core";

export interface TmpDirHelper {
  /** The absolute path of the temporary scratch directory. */
  dir: string;
  /** Resolves a relative path inside the temporary directory. */
  path(...parts: string[]): string;
  /** Writes a file inside the temporary directory. Creates parent directories if needed. */
  write(filename: string, content: string): string;
  /** Reads the string content of a file inside the temporary directory. */
  read(filename: string): string;
  /** Checks if a file or directory exists inside the temporary directory. */
  exists(filename: string): boolean;
  /** Removes a file or directory inside the temporary directory. */
  remove(filename: string): void;
}

function resolveInside(dir: string, filename: string): string {
  const target = resolve(dir, filename);
  const relativeTarget = relative(dir, target);
  if (relativeTarget === ".." || relativeTarget.startsWith(`..${sep}`)) {
    throw new Error(`Path escapes temporary directory: ${filename}`);
  }
  return target;
}

export const tmpdirFixture = createFixture<TmpDirHelper>({
  scope: "test",
  setup: async (use) => {
    const dir = mkdtempSync(join(osTmpdir(), "bun-test-utils-tmp-"));
    const helper: TmpDirHelper = {
      dir,
      path(...parts: string[]) {
        return resolveInside(dir, join(...parts));
      },
      write(filename: string, content: string) {
        const full = resolveInside(dir, filename);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, content);
        return full;
      },
      read(filename: string) {
        return readFileSync(resolveInside(dir, filename), "utf8");
      },
      exists(filename: string) {
        return existsSync(resolveInside(dir, filename));
      },
      remove(filename: string) {
        rmSync(resolveInside(dir, filename), { recursive: true, force: true });
      },
    };

    try {
      await use(helper);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
});
