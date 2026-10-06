import {
  createFixture,
  type FetchMatcher,
  installFetchInterceptor,
  matchesFetch,
} from "@bun-test-utils/core";

export type NetworkGuardMatcher = FetchMatcher;

export interface NetworkGuardCall {
  method: string;
  url: string;
  allowed: boolean;
}

export interface NetworkGuardHelper {
  /** Adds explicit passthrough entries to the allowlist. */
  allow(...matchers: NetworkGuardMatcher[]): void;
  /** Returns requests observed by the guard in call order. */
  calls(): NetworkGuardCall[];
}

export const networkGuardFixture = createFixture<NetworkGuardHelper>({
  scope: "test",
  setup: async (use) => {
    const allowlist: NetworkGuardMatcher[] = [];
    const calls: NetworkGuardCall[] = [];
    const uninstall = installFetchInterceptor((request) => {
      const allowed = allowlist.some((matcher) =>
        matchesFetch(matcher, request),
      );
      calls.push({ method: request.method, url: request.url, allowed });
      if (allowed) return undefined;
      throw new Error(
        `[bun-test-utils] networkGuard blocked unexpected fetch: ${request.method} ${request.url}. Allow it explicitly with networkGuard.allow(...).`,
      );
    });

    try {
      await use({
        allow(...matchers) {
          allowlist.push(...matchers);
        },
        calls() {
          return [...calls];
        },
      });
    } finally {
      uninstall();
    }
  },
});
