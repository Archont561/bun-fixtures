/**
 * Cassette callback serializers at the public API boundary (ADR 0024).
 *
 * Imports only published-style entrypoints: the root runner for the
 * `cassette` fixture and the `/vcr` subpath for `defineCallbackSerializer`.
 * The engine-level contract lives in `packages/vcr/tests/`; this suite pins
 * what an installed consumer composes.
 */
import { afterAll, beforeAll } from "bun:test";
import { expect, test } from "@archont561/bun-test-utils";
import { defineCallbackSerializer } from "@archont561/bun-test-utils/vcr";

/**
 * The cassette fixture's mode is pinned at the file level: every test here
 * keeps its callbacks in memory (`passthrough`, selected again in each body),
 * and the default `auto` mode refuses to resolve without a committed cassette
 * when CI is set (ADR 0036). A CI runner's environment must not change what
 * this suite means.
 */
const ambientVcrMode = process.env.VCR_MODE;
beforeAll(() => {
  process.env.VCR_MODE = "passthrough";
});
afterAll(() => {
  if (ambientVcrMode === undefined) delete process.env.VCR_MODE;
  else process.env.VCR_MODE = ambientVcrMode;
});

/** A class instance: real data, non-plain prototype — userland serializer. */
class Token {
  constructor(readonly value: string) {}
}

const tokenSerializer = defineCallbackSerializer<Token>({
  name: "token",
  version: 1,
  test: (candidate) => candidate instanceof Token,
  serialize: (token) => ({ value: token.value }),
  deserialize: (data) => new Token((data as { value: string }).value),
});

type CodedError = Error & {
  code?: string;
  details?: Record<string, unknown>;
};

function captureError(action: () => Promise<unknown>): Promise<CodedError> {
  return action().then(
    () => {
      throw new Error("Expected the cassette to refuse");
    },
    (error) => error as CodedError,
  );
}

test("the root cassette round-trips built-in serializer values", async ({
  cassette,
}) => {
  const account = () => ({
    createdAt: new Date("2026-10-09T00:00:00.000Z"),
    roles: new Map([["admin", true]]),
    tags: new Set(["a", "b"]),
    balance: 10n,
    pattern: /^user-\d+$/,
    checksum: new Uint8Array([1, 2, 3]),
    ratio: Number.NaN,
    negative: -0,
  });

  let calls = 0;
  const loadAccount = () => {
    calls++;
    return account();
  };

  // Passthrough: callbacks stay in memory, so nothing is written to the source tree (ADR 0035).
  cassette.setMode("passthrough");
  expect(await cassette.record(loadAccount)).toEqual(account());
  expect(calls).toBe(1);

  const replayed = await cassette.replay(loadAccount);
  expect(replayed).toEqual(account());
  expect(replayed.createdAt).toBeInstanceOf(Date);
  expect(replayed.roles).toBeInstanceOf(Map);
  expect(Object.is(replayed.negative, -0)).toBe(true);
  expect(calls).toBe(1);
});

test("a registered serializer round-trips a class instance", async ({
  cassette,
}) => {
  cassette.addSerializer(tokenSerializer);
  const loadToken = () => ({ token: new Token("t-1") });

  // Passthrough: callbacks stay in memory, so nothing is written to the source tree (ADR 0035).
  cassette.setMode("passthrough");
  expect(await cassette.record(loadToken)).toEqual(loadToken());
  const replayed = await cassette.replay(loadToken);
  expect(replayed.token).toBeInstanceOf(Token);
  expect(replayed.token.value).toBe("t-1");
});

test("an unclaimed class instance is still refused, with the coded hint", async ({
  cassette,
}) => {
  const error = await captureError(() => cassette.record(() => new Token("x")));
  expect(error.code).toBe("CALLBACK_NOT_SERIALIZABLE");
  expect(error.message.startsWith("[bun-test-utils/vcr] ")).toBe(true);
  expect(error.message).toContain("addSerializer");
  expect(error.details).toMatchObject({
    path: "$",
    valueType: "an instance of Token",
  });
});

test("a malformed serializer is refused at registration", async ({
  cassette,
}) => {
  const error = await captureError(async () =>
    cassette.addSerializer({ name: "broken" } as never),
  );
  expect(error.code).toBe("INVALID_API_USAGE");
});
