import { describe, expect, spyOn, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCommand } from "citty";
import {
  initCommand,
  runCacheClearCommand,
  runInitCommand,
} from "@/commands.ts";
import type { Prompter, PromptOption } from "@/prompts.ts";

/** A scripted prompter that records every question it is asked. */
function fakePrompter(answers: {
  select?: string[] | null;
  confirm?: boolean;
}): { prompter: Prompter; asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    prompter: {
      async confirm(message) {
        asked.push(`confirm: ${message}`);
        return answers.confirm ?? true;
      },
      async multiSelect(
        message: string,
        options: PromptOption[],
      ): Promise<string[] | null> {
        asked.push(`select: ${message}`);
        if (answers.select === undefined) {
          return options.map((option) => option.value);
        }
        return answers.select;
      },
    },
  };
}

/** A throwaway project with cache files matched by one test file's names. */
function fixtureProject() {
  const root = mkdtempSync(join(tmpdir(), "cli-commands-"));
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "commands-fixture", type: "module" }),
  );
  const dir = join(root, "suite");
  mkdirSync(join(dir, "__cassettes__"), { recursive: true });
  writeFileSync(
    join(dir, "api.test.ts"),
    'test("fetches the greeting", () => {});\ntest("posts a row", () => {});\n',
  );
  writeFileSync(join(dir, "__cassettes__", "fetches-the-greeting.json"), "{}");
  writeFileSync(join(dir, "__cassettes__", "posts-a-row.json"), "{}");
  return { root, dir };
}

function quiet<T>(fn: () => Promise<T>): Promise<T> {
  const log = spyOn(console, "log").mockImplementation(() => {});
  return fn().finally(() => log.mockRestore());
}

describe("command bodies (ADR 0037, rule 3)", () => {
  test("init parses arguments with citty and writes bunfig.toml", async () => {
    // CI keeps the flag-only path: the prompt would read from the test's stdin.
    const previous = process.env.CI;
    process.env.CI = "1";
    try {
      const dir = mkdtempSync(join(tmpdir(), "bun-test-utils-args-"));
      await quiet(async () => {
        const { result } = await runCommand(initCommand, {
          rawArgs: ["--dir", dir, "--entry", "./custom/plugin.ts", "--force"],
        });
        await result;
      });
      expect(readFileSync(join(dir, "bunfig.toml"), "utf8")).toContain(
        "./custom/plugin.ts",
      );
      expect(() => readFileSync(join(dir, "test.ts"), "utf8")).toThrow();
    } finally {
      if (previous === undefined) delete process.env.CI;
      else process.env.CI = previous;
    }
  });

  test("init --yes writes without asking", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cli-yes-"));
    const { prompter, asked } = fakePrompter({ confirm: false });
    // --yes resolves to a null prompter; runInitCommand(null) is that path.
    await quiet(() =>
      runInitCommand(
        { dir, entry: "./custom/plugin.ts", force: true, yes: true },
        null,
      ),
    );
    expect(asked).toEqual([]);
    expect(existsSync(join(dir, "bunfig.toml"))).toBe(true);
    // The same run with a prompter that refuses stays unwritten.
    const other = mkdtempSync(join(tmpdir(), "cli-yes-"));
    await quiet(() =>
      runInitCommand(
        { dir: other, entry: "./custom/plugin.ts", force: true, yes: false },
        prompter,
      ),
    );
    expect(asked).toHaveLength(1);
    expect(existsSync(join(other, "bunfig.toml"))).toBe(false);
  });

  test("cache clear deletes only the files the user kept selected", async () => {
    const p = fixtureProject();
    const kept = join(p.dir, "__cassettes__", "fetches-the-greeting.json");
    const dropped = join(p.dir, "__cassettes__", "posts-a-row.json");
    const { prompter, asked } = fakePrompter({ select: [kept] });
    const lines: string[] = [];
    const log = spyOn(console, "log").mockImplementation((line: string) => {
      lines.push(String(line));
    });
    try {
      await runCacheClearCommand(
        {
          file: join("suite", "api.test.ts"),
          yes: false,
        },
        prompter,
        p.root,
      );
    } finally {
      log.mockRestore();
    }
    expect(asked).toHaveLength(2); // multi-select, then confirm
    expect(existsSync(kept)).toBe(false);
    expect(existsSync(dropped)).toBe(true);
    expect(lines[0]).toContain(p.root); // names the root it scanned
    expect(lines.join("\n")).toContain("Deleted 1 file(s)");
  });

  test("cancelling the confirm deletes nothing", async () => {
    const p = fixtureProject();
    const { prompter } = fakePrompter({ confirm: false });
    const lines: string[] = [];
    const log = spyOn(console, "log").mockImplementation((line: string) => {
      lines.push(String(line));
    });
    try {
      await runCacheClearCommand(
        { file: join("suite", "api.test.ts"), yes: false },
        prompter,
        p.root,
      );
    } finally {
      log.mockRestore();
    }
    expect(
      existsSync(join(p.dir, "__cassettes__", "fetches-the-greeting.json")),
    ).toBe(true);
    expect(lines).toContain("Cancelled. Nothing was deleted.");
  });

  test("cancelling the multi-select deletes nothing", async () => {
    const p = fixtureProject();
    const { prompter } = fakePrompter({ select: null });
    const lines: string[] = [];
    const log = spyOn(console, "log").mockImplementation((line: string) => {
      lines.push(String(line));
    });
    try {
      await runCacheClearCommand(
        { file: join("suite", "api.test.ts"), yes: false },
        prompter,
        p.root,
      );
    } finally {
      log.mockRestore();
    }
    expect(
      existsSync(join(p.dir, "__cassettes__", "fetches-the-greeting.json")),
    ).toBe(true);
    expect(lines).toContain("Cancelled. Nothing was deleted.");
  });

  test("deselecting everything deletes nothing and skips the confirm", async () => {
    const p = fixtureProject();
    const { prompter, asked } = fakePrompter({ select: [] });
    const lines: string[] = [];
    const log = spyOn(console, "log").mockImplementation((line: string) => {
      lines.push(String(line));
    });
    try {
      await runCacheClearCommand(
        { file: join("suite", "api.test.ts"), yes: false },
        prompter,
        p.root,
      );
    } finally {
      log.mockRestore();
    }
    expect(asked).toHaveLength(1); // multi-select only
    expect(
      existsSync(join(p.dir, "__cassettes__", "fetches-the-greeting.json")),
    ).toBe(true);
    expect(lines).toContain("No cache files selected. Nothing was deleted.");
  });

  test("without a prompter the flags alone delete every match", async () => {
    const p = fixtureProject();
    await quiet(() =>
      runCacheClearCommand(
        { file: join("suite", "api.test.ts"), yes: true },
        null,
        p.root,
      ),
    );
    expect(
      existsSync(join(p.dir, "__cassettes__", "fetches-the-greeting.json")),
    ).toBe(false);
    expect(existsSync(join(p.dir, "__cassettes__", "posts-a-row.json"))).toBe(
      false,
    );
  });

  test("--dry-run never prompts and never deletes", async () => {
    const p = fixtureProject();
    const { prompter, asked } = fakePrompter({});
    const lines: string[] = [];
    const log = spyOn(console, "log").mockImplementation((line: string) => {
      lines.push(String(line));
    });
    try {
      await runCacheClearCommand(
        {
          file: join("suite", "api.test.ts"),
          "dry-run": true,
          yes: false,
        },
        // A prompter reaching the body must still not be used: --dry-run
        // never prompts (ADR 0037, rule 3).
        prompter,
        p.root,
      );
    } finally {
      log.mockRestore();
    }
    expect(asked).toEqual([]);
    expect(
      existsSync(join(p.dir, "__cassettes__", "fetches-the-greeting.json")),
    ).toBe(true);
    expect(lines.join("\n")).toContain("Nothing was deleted.");
  });
});
