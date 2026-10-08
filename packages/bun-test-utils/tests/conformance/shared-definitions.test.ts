import { expect, test } from "@archont561/bun-test-utils";
import {
  textFileSchema,
  textFileWithExtensionSchema,
} from "./shared/property-schemas.ts";

test.prop(
  "a shared schema infers its values in another test file",
  textFileSchema,
  async (_fixtures, { segments, contents }) => {
    const path: string = segments.join("/");
    const upperCaseContents: string = contents.toUpperCase();

    expect(path.length).toBeGreaterThan(0);
    expect(typeof upperCaseContents).toBe("string");
  },
  { numRuns: 5, seed: 20261007 },
);

test.prop(
  "a derived schema composes the shared schema",
  textFileWithExtensionSchema,
  async (_fixtures, { segments, contents, extension }) => {
    const path: string = segments.join("/");
    const upperCaseContents: string = contents.toUpperCase();
    const fileExtension: ".txt" | ".log" = extension;

    expect(`${path}${fileExtension}`).toContain(fileExtension);
    expect(typeof upperCaseContents).toBe("string");
  },
  { numRuns: 5, seed: 20261007 },
);

test.scenario
  .prop(
    "scenario property strategies infer generated values from a shared schema",
    textFileSchema,
  )
  .given("a generated text file", ({ segments, contents }) => {
    const path: string = segments.join("/");
    const body: string = contents;
    return { path, body };
  })
  .when("the path is given a filename", ({ path, body }) => ({
    filename: `${path}.txt`,
    body,
  }))
  .then(
    "the generated path and body remain available",
    ({ filename, body }) => {
      const inferredFilename: string = filename;
      const inferredBody: string = body;
      expect(inferredFilename.length).toBeGreaterThan(0);
      expect(typeof inferredBody).toBe("string");
    },
  );
