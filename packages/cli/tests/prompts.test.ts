import { describe, expect, test } from "bun:test";
import {
  isInteractive,
  type Prompter,
  promptEnv,
  resolvePrompter,
} from "@/prompts.ts";

const sentinel: Prompter = {
  confirm: async () => true,
  multiSelect: async () => [],
};

describe("resolvePrompter (ADR 0037, rule 3)", () => {
  test("prompts only in a TTY without CI, and only then", () => {
    let made = 0;
    const make = () => {
      made++;
      return sentinel;
    };
    const flags = { yes: false, dryRun: false };

    expect(resolvePrompter(flags, { tty: true, ci: false }, make)).toBe(
      sentinel,
    );
    expect(resolvePrompter(flags, { tty: false, ci: false }, make)).toBeNull();
    expect(resolvePrompter(flags, { tty: true, ci: true }, make)).toBeNull();
    expect(resolvePrompter(flags, { tty: false, ci: true }, make)).toBeNull();
    expect(made).toBe(1);
  });

  test("--yes and --dry-run never prompt, even in a TTY", () => {
    const make = () => {
      throw new Error("must not build a prompter");
    };
    expect(
      resolvePrompter(
        { yes: true, dryRun: false },
        { tty: true, ci: false },
        make,
      ),
    ).toBeNull();
    expect(
      resolvePrompter(
        { yes: false, dryRun: true },
        { tty: true, ci: false },
        make,
      ),
    ).toBeNull();
    expect(
      resolvePrompter(
        { yes: true, dryRun: true },
        { tty: true, ci: false },
        make,
      ),
    ).toBeNull();
  });

  test("promptEnv and isInteractive read the current process", () => {
    const env = promptEnv();
    expect(typeof env.tty).toBe("boolean");
    expect(typeof env.ci).toBe("boolean");
    expect(isInteractive()).toBe(env.tty && !env.ci);
  });
});
