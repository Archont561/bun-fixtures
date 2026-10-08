import type { GivenChain } from "@archont561/bun-test-utils/bdd";
import { givenStep, thenStep, whenStep } from "@archont561/bun-test-utils/bdd";

/** Shared step that exercises fixture detection from an imported module. */
export const writeSharedFile = givenStep<
  object,
  { filename: string; expectedText: string }
>(({ tmpdir }) => {
  const filename = "scenario-sharing.txt";
  const expectedText = "the shared scenario step wrote this file";
  tmpdir.write(filename, expectedText);
  return { filename, expectedText };
});

/** The context slice is declared independently from the scenario chain. */
export const readSharedFile = whenStep<
  { filename: string; expectedText: string },
  { actualText: string }
>(({ tmpdir, filename }) => ({
  actualText: tmpdir.read(filename),
}));

export const assertSharedFile = thenStep<{
  filename: string;
  expectedText: string;
  actualText: string;
}>(({ actualText, expectedText, expect }) => {
  expect(actualText).toBe(expectedText);
});

/**
 * Consumer-level sequence convention: compose existing steps around a chain.
 * This is ordinary application code, not a runtime bun-test-utils helper.
 */
export const withSharedFile = (scenario: GivenChain) =>
  scenario
    .given("a file written by a shared step", writeSharedFile)
    .when("the file is read by a shared step", readSharedFile);
