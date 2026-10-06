/**
 * The `stdio` fixture, composed the way a consumer composes it.
 *
 * The real stream writers are captured at module scope, before any fixture
 * patches them, so the following test can prove the engine's teardown put
 * the originals back rather than leaving a capture buffer installed for the
 * rest of the run.
 */

import { describe, expect, test } from "@/index.ts";

const realStdoutWrite = process.stdout.write;
const realStderrWrite = process.stderr.write;

describe("@bun-test-utils/std stdio", () => {
  test("captures stdout and stderr, and clears the buffers", async ({
    stdio,
  }) => {
    expect(process.stdout.write).not.toBe(realStdoutWrite);

    process.stdout.write("hello stdout\n");
    process.stderr.write("hello stderr\n");
    expect(stdio.stdout()).toContain("hello stdout");
    expect(stdio.stderr()).toContain("hello stderr");
    expect(stdio.output()).toContain("hello stdout\nhello stderr");

    stdio.clear();
    expect(stdio.stdout()).toBe("");
    expect(stdio.stderr()).toBe("");
  });

  test("engine teardown restored the real stream writers", async () => {
    expect(process.stdout.write).toBe(realStdoutWrite);
    expect(process.stderr.write).toBe(realStderrWrite);
  });
});
