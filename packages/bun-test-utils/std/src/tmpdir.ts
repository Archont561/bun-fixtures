import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir as osTmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { FixtureDef } from "bun-test-utils";

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

export const tmpdirFixture: FixtureDef<TmpDirHelper> = {
  scope: "test",
  setup: async (use) => {
    const dir = mkdtempSync(join(osTmpdir(), "bun-test-utils-tmp-"));
    const helper: TmpDirHelper = {
      dir,
      path(...parts: string[]) {
        return join(dir, ...parts);
      },
      write(filename: string, content: string) {
        const full = join(dir, filename);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, content);
        return full;
      },
      read(filename: string) {
        return readFileSync(join(dir, filename), "utf8");
      },
      exists(filename: string) {
        return existsSync(join(dir, filename));
      },
      remove(filename: string) {
        rmSync(join(dir, filename), { recursive: true, force: true });
      },
    };

    try {
      await use(helper);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
};
