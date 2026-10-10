import { afterAll, beforeAll } from "bun:test";
import { expect, test } from "@archont561/bun-test-utils";

/**
 * The cassette fixture's mode is pinned at the file level: the cassette test
 * below keeps every callback in memory (`passthrough`, selected again in the
 * body), and the default `auto` mode refuses to resolve without a committed
 * cassette when CI is set (ADR 0036). A CI runner's environment must not
 * change what this suite means.
 */
const ambientVcrMode = process.env.VCR_MODE;
beforeAll(() => {
  process.env.VCR_MODE = "passthrough";
});
afterAll(() => {
  if (ambientVcrMode === undefined) delete process.env.VCR_MODE;
  else process.env.VCR_MODE = ambientVcrMode;
});

const overrideTest = test
  .extend({
    shared: { setup: async (use: any) => use("left") },
  })
  .extend({
    shared: { setup: async (use: any) => use("right") },
  });

const builtInFixtureKeys = [
  "clock",
  "seed",
  "networkGuard",
  "tmpdir",
  "env",
  "stdio",
  "window",
  "document",
  "page",
  "testServer",
  "serverUrl",
  "browser",
  "browserContext",
  "browserPage",
  "webPage",
  "httpMock",
  "browserHttpMock",
  "cassette",
  "snapshot",
] as const;

const builtInCollisionTest = test.extend(
  Object.fromEntries(
    builtInFixtureKeys.map((key) => [
      key,
      {
        setup: async (use: (value: string) => Promise<void>) => {
          await use(`consumer:${key}`);
        },
      },
    ]),
  ),
);

test("standard and VCR fixtures are available from the root test context", async ({
  cassette,
  tmpdir,
}) => {
  let calls = 0;
  const getUser = () => {
    calls++;
    return { id: "user-1" };
  };

  tmpdir.write("seed.txt", "ok");
  expect(tmpdir.read("seed.txt")).toBe("ok");
  // Passthrough: callbacks stay in memory, so nothing is written to the source tree (ADR 0035).
  cassette.setMode("passthrough");
  expect(await cassette.record(getUser)).toEqual({ id: "user-1" });
  expect(await cassette.replay(getUser)).toEqual({ id: "user-1" });
  expect(calls).toBe(1);
});

test("DOM, server, and snapshot fixtures are available from the root test context", async ({
  page,
  snapshot,
  serverUrl,
  testServer,
}) => {
  page.mount('<button id="add">add</button><span id="count">0</span>');
  page.querySelector("#add")!.addEventListener("click", () => {
    page.querySelector("#count")!.textContent = "1";
  });
  page.click("#add");
  expect(page.html()).toContain(">1</span>");

  testServer.handle(() => Response.json({ status: "ok" }));
  const response = await fetch(serverUrl);
  expect(await response.json()).toEqual({ status: "ok" });

  snapshot.setMode("update");
  expect(snapshot.mode).toBe("update");
  expect(snapshot.path).toContain("__snapshots__");
});

test("webPage and httpMock fixtures are available from the root test context", async ({
  httpMock,
  webPage,
}) => {
  expect(webPage.mode).toBe("dom");
  httpMock.get("/api/user", () => Response.json({ name: "Ada" }));

  const user = await fetch("https://example.test/api/user").then((response) =>
    response.json(),
  );
  expect(user).toEqual({ name: "Ada" });
  expect(httpMock.calls()[0]).toMatchObject({ handled: true });

  await webPage.setContent('<span id="name"></span>');
  webPage.raw.document.querySelector("#name")!.textContent = user.name;
  expect(await webPage.textContent("#name")).toBe("Ada");
});

builtInCollisionTest(
  "consumer fixtures override every built-in context key",
  async (context) => {
    for (const key of builtInFixtureKeys) {
      expect(context[key]).toBe(`consumer:${key}`);
    }
  },
  { fixtures: [...builtInFixtureKeys] },
);

overrideTest(
  "later extensions override earlier consumer definitions",
  async ({ shared }) => {
    expect(shared).toBe("right");
  },
);
