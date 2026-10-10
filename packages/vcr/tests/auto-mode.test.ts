/**
 * The `auto` cassette mode (ADR 0036).
 *
 * `auto` is the default. A present cassette replays, an absent one records,
 * CI refuses to record, and only a completed body writes the cache.
 *
 * Teardown runs after the body, so each case calls the fixture's `setup`
 * directly with its own body. That lets a case observe the mode, the requests
 * it made, the files a run wrote, and the error it raised.
 */

import { afterAll, test as bunTest } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import type { FixtureContext } from "@bun-test-utils/core";
import {
  CassetteError,
  type CassetteHelper,
  cassetteFixture,
  describe,
  expect,
} from "@/index.ts";

const scratchDir = mkdtempSync(join(tmpdir(), "vcr-auto-"));
const scratchFile = join(scratchDir, "auto.test.ts");
afterAll(() => rmSync(scratchDir, { recursive: true, force: true }));

/** Mirrors the fixture's slug rule, so expected paths cannot drift. */
const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "cassette";

const cassettePathFor = (testName: string) =>
  join(scratchDir, "__cassettes__", `${slugify(testName)}.json`);
const sidecarPathFor = (testName: string) =>
  join(scratchDir, "__cassettes__", `${slugify(testName)}.callbacks.json`);

const ctxFor = (testName: string): FixtureContext => ({
  testFile: scratchFile,
  testName,
});

/** Sets env vars for one case and returns a restore function. */
function setEnv(vars: Record<string, string | undefined>): () => void {
  const saved: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

/** Writes a one-entry cassette, as an earlier run would have. */
function seedCassette(testName: string, url: string, body: string): void {
  mkdirSync(join(scratchDir, "__cassettes__"), { recursive: true });
  writeFileSync(
    cassettePathFor(testName),
    JSON.stringify([
      {
        request: { method: "GET", url, headers: {} },
        response: { status: 200, statusText: "OK", headers: {}, body },
      },
    ]),
  );
}

/** Runs the fixture for `testName` with `body` as the test body, under `env`. */
async function runCase(
  testName: string,
  env: Record<string, string | undefined>,
  body: (helper: CassetteHelper) => Promise<void>,
): Promise<void> {
  const restore = setEnv(env);
  try {
    await cassetteFixture.setup(body, ctxFor(testName));
  } finally {
    restore();
  }
}

const AUTO = { VCR_MODE: undefined, CI: undefined };

describe("auto mode (ADR 0036)", () => {
  bunTest(
    "resolves to record without a cassette, and a completed run writes the cache",
    async () => {
      const name = "auto fresh completes";
      let mode: string | undefined;
      await runCase(name, AUTO, async (helper) => {
        mode = helper.mode;
        await helper.record(() => "value");
      });
      expect(mode).toBe("record");
      expect(existsSync(sidecarPathFor(name))).toBe(true);
      expect(existsSync(cassettePathFor(name))).toBe(true);
    },
  );

  bunTest(
    "resolves to replay when a cassette exists and serves its entries",
    async () => {
      const name = "auto present replays";
      seedCassette(name, "https://auto.test/hello", "seeded");
      let mode: string | undefined;
      let text: string | undefined;
      await runCase(name, AUTO, async (helper) => {
        mode = helper.mode;
        text = await (await fetch("https://auto.test/hello")).text();
      });
      expect(mode).toBe("replay");
      expect(text).toBe("seeded");
    },
  );

  bunTest(
    "a request missing from a present cassette fails with CASSETTE_MISMATCH and names the clear command",
    async () => {
      const name = "auto miss hint";
      seedCassette(name, "https://auto.test/hello", "seeded");
      let caught: unknown;
      await runCase(name, AUTO, async () => {
        caught = await fetch("https://auto.test/other").catch((error) => error);
      });
      expect(caught).toBeInstanceOf(CassetteError);
      const error = caught as CassetteError;
      expect(error.code).toBe("CASSETTE_MISMATCH");
      expect(error.message).toContain("bunx test-utils cache clear --file ");
      expect(error.message).toContain(relative(process.cwd(), scratchFile));
      expect(error.message).toContain(`--test ${JSON.stringify(name)}`);
    },
  );

  bunTest(
    "CI with no cassette fails with CASSETTE_NOT_FOUND and never runs the body",
    async () => {
      const name = "auto ci refuses";
      let bodyRan = false;
      let caught: unknown;
      try {
        await runCase(name, { VCR_MODE: undefined, CI: "true" }, async () => {
          bodyRan = true;
        });
      } catch (error) {
        caught = error;
      }
      expect(bodyRan).toBe(false);
      expect(caught).toBeInstanceOf(CassetteError);
      expect((caught as CassetteError).code).toBe("CASSETTE_NOT_FOUND");
      expect(existsSync(cassettePathFor(name))).toBe(false);
      expect(existsSync(sidecarPathFor(name))).toBe(false);
    },
  );

  bunTest("CI with a cassette present still replays", async () => {
    const name = "auto ci replays";
    seedCassette(name, "https://auto.test/hello", "ci-seeded");
    let text: string | undefined;
    await runCase(name, { VCR_MODE: undefined, CI: "true" }, async () => {
      text = await (await fetch("https://auto.test/hello")).text();
    });
    expect(text).toBe("ci-seeded");
  });

  bunTest("auto writes nothing when the body throws", async () => {
    const name = "auto failed body";
    let caught: unknown;
    try {
      await runCase(name, AUTO, async (helper) => {
        await helper.record(() => "partial");
        throw new Error("boom");
      });
    } catch (error) {
      caught = error;
    }
    expect((caught as Error).message).toBe("boom");
    expect(existsSync(cassettePathFor(name))).toBe(false);
    expect(existsSync(sidecarPathFor(name))).toBe(false);
  });

  bunTest("explicit record still writes when the body throws", async () => {
    const name = "explicit record failed body";
    try {
      await runCase(name, { VCR_MODE: "record" }, async (helper) => {
        await helper.record(() => "kept");
        throw new Error("boom");
      });
    } catch {
      // expected: the body's error propagates through the fixture
    }
    expect(existsSync(sidecarPathFor(name))).toBe(true);
  });
});
