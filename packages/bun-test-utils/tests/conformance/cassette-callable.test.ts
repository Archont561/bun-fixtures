/** Public-root proof for the callable cassette form (ADR 0039). */
import { afterAll, beforeAll } from "bun:test";
import { expect, test } from "@archont561/bun-test-utils";

const ambientVcrMode = process.env.VCR_MODE;
beforeAll(() => {
  // Fixture setup happens before the body, so pin a mode that does not require
  // a committed scratch cassette when the outer test process has CI set.
  process.env.VCR_MODE = "passthrough";
});
afterAll(() => {
  if (ambientVcrMode === undefined) delete process.env.VCR_MODE;
  else process.env.VCR_MODE = ambientVcrMode;
});

test("the root cassette is callable and retains its methods", async ({
  cassette,
}) => {
  let calls = 0;
  const load = async () => ({ id: `user-${++calls}` });

  expect(await cassette(load)).toEqual({ id: "user-1" });
  expect(await cassette(load)).toEqual({ id: "user-2" });
  expect(cassette.record).toBeDefined();
  expect(cassette.replay).toBeDefined();
});
