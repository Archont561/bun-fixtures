import type { FixtureDef } from "bun-fixture";

export interface StdioHelper {
  /** Captured stdout string. */
  stdout(): string;
  /** Captured stderr string. */
  stderr(): string;
  /** Combined captured stdout and stderr. */
  output(): string;
  /** Clears captured buffers. */
  clear(): void;
}

export const stdioFixture: FixtureDef<StdioHelper> = {
  scope: "test",
  setup: async (use) => {
    let capturedOut = "";
    let capturedErr = "";

    const origStdoutWrite = process.stdout.write;
    const origStderrWrite = process.stderr.write;

    process.stdout.write = ((chunk: any, ..._args: any[]) => {
      capturedOut += typeof chunk === "string" ? chunk : chunk.toString();
      return true;
    }) as any;

    process.stderr.write = ((chunk: any, ..._args: any[]) => {
      capturedErr += typeof chunk === "string" ? chunk : chunk.toString();
      return true;
    }) as any;

    const helper: StdioHelper = {
      stdout() {
        return capturedOut;
      },
      stderr() {
        return capturedErr;
      },
      output() {
        return capturedOut + capturedErr;
      },
      clear() {
        capturedOut = "";
        capturedErr = "";
      },
    };

    try {
      await use(helper);
    } finally {
      process.stdout.write = origStdoutWrite;
      process.stderr.write = origStderrWrite;
    }
  },
};
