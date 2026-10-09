Feature: Cassette callback serializers
  Scenario: Root cassette round-trips built-in and custom serializer values
    Given a project with bun-test-utils preloaded
    And the file "serializers.test.ts":
      """
      import { expect, test } from "@archont561/bun-test-utils";
      import { defineCallbackSerializer } from "@archont561/bun-test-utils/vcr";

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

      test("round-trips serializer-backed callback values", async ({ cassette }) => {
        cassette.addSerializer(tokenSerializer);
        const value = () => ({
          at: new Date(0),
          roles: new Map([["admin", true]]),
          balance: 10n,
          token: new Token("t-1"),
        });
        let calls = 0;
        const load = () => {
          calls++;
          return value();
        };
        expect(await cassette.record(load)).toEqual(value());
        expect(await cassette.replay(load)).toEqual(value());
        expect(calls).toBe(1);
      });
      """
    When I run the test suite
    Then 1 test passes
