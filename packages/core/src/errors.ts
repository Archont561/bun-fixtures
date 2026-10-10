import type { BunTestUtilsErrorCode } from "./types.ts";

/** Base error thrown by bun-test-utils with a stable machine-readable code. */
export class BunTestUtilsError extends Error {
  readonly code: BunTestUtilsErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: BunTestUtilsErrorCode,
    message: string,
    options?: { cause?: unknown; details?: Record<string, unknown> },
  ) {
    super(message, { cause: options?.cause });
    this.name = "BunTestUtilsError";
    this.code = code;
    this.details = options?.details;
  }
}

/** An explicitly requested fixture does not exist. */
export class UnknownFixtureError extends BunTestUtilsError {
  constructor(
    name: string,
    available: string[],
    file: string,
    message: string,
  ) {
    super("UNKNOWN_FIXTURE", message, { details: { name, available, file } });
    this.name = "UnknownFixtureError";
  }
}

/** A fixture depends on a fixture with a shorter lifetime. */
export class FixtureScopeError extends BunTestUtilsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("SCOPE_MISMATCH", message, { details });
    this.name = "FixtureScopeError";
  }
}

/** The fixture dependency graph contains a cycle. */
export class FixtureDependencyError extends BunTestUtilsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("CIRCULAR_DEPENDENCY", message, { details });
    this.name = "FixtureDependencyError";
  }
}

/** A fixture violated the setup/use lifecycle protocol. */
export class FixtureLifecycleError extends BunTestUtilsError {
  constructor(
    code: "FIXTURE_USE_NOT_CALLED" | "FIXTURE_USE_CALLED_TWICE",
    message: string,
  ) {
    super(code, message);
    this.name = "FixtureLifecycleError";
  }
}

/** An optional capability dependency is not installed. */
export class MissingOptionalDependencyError extends BunTestUtilsError {
  constructor(packageName: string, installCommand: string, message: string) {
    super("MISSING_OPTIONAL_DEPENDENCY", message, {
      details: { packageName, installCommand },
    });
    this.name = "MissingOptionalDependencyError";
  }
}

/** A cassette or callback registry operation could not be fulfilled. */
export class CassetteError extends BunTestUtilsError {
  constructor(
    code:
      | "CASSETTE_NOT_FOUND"
      | "CASSETTE_MISMATCH"
      | "CALLBACK_AMBIGUOUS"
      | "CALLBACK_NOT_RECORDED"
      | "CALLBACK_NOT_SERIALIZABLE"
      | "CALLBACK_SERIALIZER_NOT_FOUND"
      | "CALLBACK_SERIALIZER_FAILED"
      | "CALLBACK_STORE_INVALID"
      | "INVALID_API_USAGE",
    message: string,
    details?: Record<string, unknown>,
    cause?: unknown,
  ) {
    super(code, message, { details, cause });
    this.name = "CassetteError";
  }
}
