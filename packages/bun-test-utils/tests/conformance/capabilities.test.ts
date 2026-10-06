import { expect, test } from "bun-test-utils";

const overrideTest = test
  .extend({
    shared: { setup: async (use: any) => use("left") },
  })
  .extend({
    shared: { setup: async (use: any) => use("right") },
  });

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

overrideTest(
  "extend order controls explicit fixture overrides",
  async ({ shared }) => {
    expect(shared).toBe("right");
  },
);
