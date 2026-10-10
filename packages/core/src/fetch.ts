/**
 * Fetch interception and filename helpers shared by the HTTP-facing fixtures
 * (split out of plugin.ts — audit 2026-10-06, finding 3). No engine state;
 * standalone utilities.
 */

/** A URL matcher shared by fetch-intercepting fixtures. */
export type FetchMatcher = string | RegExp | ((request: Request) => boolean);

/** Matches an intercepted request without consuming its body. */
export function matchesFetch(matcher: FetchMatcher, request: Request): boolean {
  if (typeof matcher === "function") return matcher(request.clone());
  if (matcher instanceof RegExp) {
    matcher.lastIndex = 0;
    return matcher.test(request.url);
  }
  const url = new URL(request.url);
  if (/^https?:\/\//.test(matcher) || matcher.startsWith("data:")) {
    return request.url === matcher;
  }
  return url.pathname === matcher || request.url.endsWith(matcher);
}

/** Installs one global fetch interceptor and returns its idempotent teardown. */
export function installFetchInterceptor(
  intercept: (
    request: Request,
  ) => Response | undefined | Promise<Response | undefined>,
): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await intercept(new Request(input, init));
    return response ?? originalFetch(input, init);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

/** Creates a stable, filesystem-safe filename component. */
export function slugifyFilename(name: string, fallback: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || fallback
  );
}
