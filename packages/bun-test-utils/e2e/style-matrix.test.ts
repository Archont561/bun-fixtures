/**
 * The file-bearing cells of the wrapper's style matrix (spec 0015, task_039).
 *
 * `tests/conformance/style-matrix.test.ts` proves the property matrix that
 * needs no filesystem; this suite proves the two cells whose fixtures are
 * bound to the file convention — snapshot writes `__snapshots__/` and the
 * cassette writes `__cassettes__/` next to the test file. Neither convention
 * can be redirected (ADR 0019), so both cells run in a scratch project built
 * by the BDD harness, exactly as a consumer would experience them, and the
 * scratch directory takes the generated files with it when it is removed.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "@archont561/bun-test-utils";
import {
  createProject,
  type Project,
  type RunResult,
  removeProject,
  runTests,
  writeProjectFile,
} from "./bdd/support/project.ts";

const SEED = 20261007;

/** `bun test` inside the scratch project must be green before anything else is asserted. */
function expectGreenRun(run: RunResult): void {
  expect(run.exitCode).toBe(0);
  expect(run.output).toContain("1 pass");
  expect(run.output).toContain("0 fail");
}

/** Files written under `<project>/<dirName>/`, so the convention can be asserted. */
function filesIn(project: Project, dirName: string): string[] {
  return readdirSync(join(project.dir, dirName));
}

describe("style matrix: file-bearing cells in a scratch project", () => {
  test("snapshot × pbt: generated values normalize to a fixed point", async () => {
    const project = createProject();
    try {
      writeProjectFile(
        project,
        "snapshot-matrix.test.ts",
        `import { expect, test } from "@archont561/bun-test-utils";

function withRotatedKeys(value) {
  if (Array.isArray(value)) return value.map(withRotatedKeys);
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value);
    const rotated = keys.slice(1).concat(keys.slice(0, 1));
    const out = {};
    for (const key of rotated) out[key] = withRotatedKeys(value[key]);
    return out;
  }
  return value;
}

// Stored snapshots persist across the property run, so every sample claims
// its own key — otherwise sample 2 would be compared against sample 1.
let sample = 0;

test.prop(
  "key insertion order does not change the stored snapshot",
  (fc) => ({ value: fc.jsonValue({ maxDepth: 3 }) }),
  async ({ snapshot }, { value }) => {
    const key = \`value-\${++sample}\`;
    snapshot.setMode("match");
    snapshot.match(value, key);
    expect(() => snapshot.match(withRotatedKeys(value), key)).not.toThrow();
    expect(() =>
      snapshot.match(withRotatedKeys(withRotatedKeys(value)), key),
    ).not.toThrow();
  },
  { numRuns: 25, seed: ${SEED} },
);`,
      );

      expectGreenRun(runTests(project));

      // The convention put the snapshot next to the test file, and every one
      // of the 25 generated samples is in it — the fixed point held for each,
      // or the run above would have failed.
      const snapshotFiles = filesIn(project, "__snapshots__");
      expect(snapshotFiles).toHaveLength(1);
      expect(snapshotFiles[0]!.endsWith(".snap.json")).toBe(true);
      const stored = JSON.parse(
        readFileSync(
          join(project.dir, "__snapshots__", snapshotFiles[0]!),
          "utf8",
        ),
      );
      const keys = Object.keys(stored);
      expect(keys).toHaveLength(25);
      for (const key of keys) {
        expect(key).toMatch(/^value-\d+$/);
        expect(typeof stored[key]).toBe("string");
      }
    } finally {
      removeProject(project);
    }
  });

  test("vcr × pbt: recorded HTTP responses replay by method and exact URL", async () => {
    const project = createProject();
    try {
      writeProjectFile(
        project,
        "vcr-matrix.test.ts",
        `import { expect, test } from "@archont561/bun-test-utils";

test.prop(
  "record then replay matches on method and full URL",
  (fc) => ({
    id: fc.stringMatching(/^[a-z0-9]{8}$/),
    header: fc.stringMatching(/^[a-z0-9]{1,12}$/),
  }),
  async ({ cassette, testServer }, { id, header }) => {
    testServer.handle(
      (req) => Response.json({ path: new URL(req.url).pathname }),
    );

    cassette.setMode("record");
    const url = \`\${testServer.url}/items/\${id}\`;
    const live = await fetch(url, { headers: { "x-matrix": header } });
    const body = await live.text();
    expect(cassette.entries).toHaveLength(1);
    expect(cassette.entries[0].request.url).toBe(url);

    cassette.setMode("replay");
    const replayed = await fetch(url, { headers: { "x-matrix": "other" } });
    expect(await replayed.text()).toBe(body);

    let mismatch;
    try {
      await fetch(url, { method: "POST", headers: { "x-matrix": header } });
    } catch (caught) {
      mismatch = caught;
    }
    expect(mismatch?.code).toBe("CASSETTE_MISMATCH");

    // Leave the fixture in record mode so its teardown persists the cassette
    // at the convention path.
    cassette.setMode("record");
  },
  { numRuns: 20, seed: ${SEED} },
);`,
      );

      expectGreenRun(runTests(project));

      const cassetteFiles = filesIn(project, "__cassettes__");
      expect(cassetteFiles).toHaveLength(1);
      const entries = JSON.parse(
        readFileSync(
          join(project.dir, "__cassettes__", cassetteFiles[0]!),
          "utf8",
        ),
      );
      expect(entries).toHaveLength(1);
      expect(entries[0].request.method).toBe("GET");
      expect(entries[0].request.url).toContain("/items/");
      expect(entries[0].response.status).toBe(200);
    } finally {
      removeProject(project);
    }
  });
});
