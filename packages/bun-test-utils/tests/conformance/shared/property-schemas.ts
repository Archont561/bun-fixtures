import { propTestSchema } from "bun-test-utils";

/** Shared value schema used by property tests in separate files. */
export const textFileSchema = propTestSchema((fc) => ({
  segments: fc.array(fc.stringMatching(/^[a-z0-9]{1,8}$/), {
    minLength: 1,
    maxLength: 4,
  }),
  contents: fc.stringMatching(/^[\x20-\x7e]{0,32}$/),
}));

/** A composed schema extends the shared base with a generated extension. */
export const textFileWithExtensionSchema = propTestSchema((fc) => ({
  ...textFileSchema(fc),
  extension: fc.constantFrom(".txt", ".log"),
}));
