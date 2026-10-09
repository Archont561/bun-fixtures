/**
 * Characterization: the cassette FILE format is a bare array of HTTP entries,
 * and raw HTTP replay is byte-compatible across save/load cycles.
 *
 * These tests pin behaviour that existed before callback serializers (ADR
 * 0034) and MUST keep passing unchanged while serializers land: the fetch
 * interception, `entries`, `save()`, and `load()` are untouched by callback
 * encoding, callback results never reach the cassette file, and a legacy
 * cassette recorded by an older version loads and replays identically.
 *
 * The golden file `fixtures/legacy-http-cassette.json` is byte-for-byte what
 * `save()` writes: `JSON.stringify(entries, null, 2)`, no trailing newline.
 */

import { afterAll } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTest } from "@bun-test-utils/core";
import { cassetteFixture, describe, expect } from "@/index.ts";

const scratchDir = mkdtempSync(join(tmpdir(), "vcr-compat-"));
const scratchFile = join(scratchDir, "compat.test.ts");
afterAll(() => rmSync(scratchDir, { recursive: true, force: true }));

const goldenPath = join(
  import.meta.dir,
  "fixtures",
  "legacy-http-cassette.json",
);
const goldenBytes = readFileSync(goldenPath, "utf8");

/** A live origin server, torn down by the engine when the test ends. */
const serverFixture = {
  setup: async (use: (value: { url: string; stop: () => void }) => unknown) => {
    const server = Bun.serve({
      port: 0,
      fetch() {
        return new Response('{"hello":"vcr","unicode":"héllo ✓"}', {
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    let stopped = false;
    const stop = () => {
      if (!stopped) {
        stopped = true;
        server.stop(true);
      }
    };
    try {
      await use({ url: `http://localhost:${server.port}`, stop });
    } finally {
      stop();
    }
  },
};

const { test: scratchTest } = createTest(scratchFile);
const test = scratchTest.extend({
  cassette: cassetteFixture,
  server: serverFixture,
});

describe("cassette file byte-compatibility (characterization)", () => {
  test("load() reads a legacy bare-array cassette file", async ({
    cassette,
  }) => {
    cassette.load(goldenPath);

    expect(cassette.entries).toHaveLength(2);
    expect(cassette.entries[0]!.request).toEqual({
      method: "GET",
      url: "https://api.example.invalid/v1/users/user-1",
      headers: { accept: "application/json" },
    });
    expect(cassette.entries[1]!.response.body).toBe(
      '{"id":"user-2","name":"Grace","notes":"héllo ✓ — ünicode"}',
    );
  });

  test("save() writes the loaded legacy cassette byte-identically", async ({
    cassette,
  }) => {
    cassette.load(goldenPath);
    const outPath = join(scratchDir, "resave.json");
    cassette.save(outPath);

    // Pins the exact on-disk schema: bare array, two-space indent, key order
    // preserved, no trailing newline, no envelope or version wrapper.
    expect(readFileSync(outPath, "utf8")).toBe(goldenBytes);
    expect(Array.isArray(JSON.parse(goldenBytes))).toBe(true);
  });

  test("replay from the legacy file serves byte-identical responses offline", async ({
    cassette,
  }) => {
    cassette.load(goldenPath);
    cassette.setMode("replay");

    // No server exists for api.example.invalid; a fulfilled match proves the
    // response came from the file, byte for byte.
    const res = await fetch("https://api.example.invalid/v1/users/user-1");
    expect(res.status).toBe(200);
    expect(res.statusText).toBe("OK");
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(await res.text()).toBe('{"id":"user-1","name":"Ada"}');

    const created = await fetch("https://api.example.invalid/v1/users", {
      method: "POST",
      body: '{"name":"Grace"}',
    });
    expect(created.status).toBe(201);
    expect(await created.text()).toBe(
      '{"id":"user-2","name":"Grace","notes":"héllo ✓ — ünicode"}',
    );
  });

  test("record then save then load then replay round-trips HTTP bytes without network", async ({
    cassette,
    server,
  }) => {
    cassette.setMode("record");
    const live = await fetch(`${server.url}/greeting`);
    const liveBody = await live.text();

    const outPath = join(scratchDir, "roundtrip.json");
    cassette.save(outPath);

    // Stop the origin: any fulfilled request now provably came from the file.
    server.stop();

    cassette.load(outPath);
    cassette.setMode("replay");
    const replayed = await fetch(`${server.url}/greeting`);
    expect(replayed.status).toBe(live.status);
    expect(await replayed.text()).toBe(liveBody);
    expect(liveBody).toContain("héllo ✓");
  });

  test("callback results never reach the cassette file", async ({
    cassette,
    server,
  }) => {
    const marker = "callback-marker-9f3a";
    const loadUser = () => ({ marker, id: "user-1" });
    expect(await cassette.record(loadUser)).toEqual({ marker, id: "user-1" });

    cassette.setMode("record");
    await fetch(`${server.url}/greeting`);

    const outPath = join(scratchDir, "http-only.json");
    cassette.save(outPath);

    const bytes = readFileSync(outPath, "utf8");
    expect(bytes).not.toContain(marker);
    const parsed = JSON.parse(bytes) as unknown;
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
  });
});
