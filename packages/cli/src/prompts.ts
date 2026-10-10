/**
 * Prompt layer (ADR 0037, rule 3).
 *
 * Prompts appear only in a TTY without `CI` set, and never for `--yes` or
 * `--dry-run` runs. Everywhere else the flags alone decide what happens. The
 * prompter is injected into the command bodies so tests can cover both the
 * interactive and the flag-only branch.
 */

import * as prompts from "@clack/prompts";

export interface PromptOption {
  value: string;
  label: string;
}

export interface Prompter {
  /** Asks a yes/no question. Cancellation counts as "no". */
  confirm(message: string): Promise<boolean>;
  /**
   * Lets the user pick a subset of `options`; every option starts selected.
   * Returns null when the user cancels.
   */
  multiSelect(
    message: string,
    options: PromptOption[],
  ): Promise<string[] | null>;
}

export interface PromptFlags {
  /** `--yes`: skip every prompt. */
  yes: boolean;
  /** `--dry-run`: never prompts and never deletes. */
  dryRun: boolean;
}

export interface PromptEnvironment {
  /** stdin and stdout are both TTYs. */
  tty: boolean;
  /** `CI` is set. */
  ci: boolean;
}

/** The prompting environment of the current process. */
export function promptEnv(): PromptEnvironment {
  return {
    tty: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    ci: Boolean(process.env.CI),
  };
}

/** Whether a run may prompt at all, ignoring the `--yes`/`--dry-run` flags. */
export function isInteractive(): boolean {
  const env = promptEnv();
  return env.tty && !env.ci;
}

/**
 * The prompter for a run, or null when the run must not prompt: `--yes`,
 * `--dry-run`, a non-TTY, or `CI` set. `make` exists for tests.
 */
export function resolvePrompter(
  flags: PromptFlags,
  env: PromptEnvironment,
  make: () => Prompter = clackPrompter,
): Prompter | null {
  if (flags.yes || flags.dryRun) return null;
  if (!env.tty || env.ci) return null;
  return make();
}

/** The real prompter, backed by `@clack/prompts`. */
export function clackPrompter(): Prompter {
  return {
    async confirm(message) {
      const answer = await prompts.confirm({ message });
      return !prompts.isCancel(answer) && answer === true;
    },
    async multiSelect(message, options) {
      const answer = await prompts.multiselect({
        message,
        options: options.map((option) => ({
          value: option.value,
          label: option.label,
        })),
        // All selected by default: the user deselects (ADR 0037, rule 3).
        initialValues: options.map((option) => option.value),
        required: false,
      });
      return prompts.isCancel(answer) ? null : [...answer];
    },
  };
}
