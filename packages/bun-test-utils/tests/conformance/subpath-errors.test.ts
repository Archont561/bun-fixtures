/**
 * Conformance: every public subpath declaration exports the supported typed
 * error surface — the base error from all of them, and each capability's own
 * errors from its subpath (task_029 criterion: "Public root and subpath
 * declarations export the supported error types").
 */
import { expect, test } from "bun-test-utils";
import { BunTestUtilsError } from "bun-test-utils/bdd";
import {
  BunTestUtilsError as BrowserBase,
  MissingOptionalDependencyError as BrowserMissing,
} from "bun-test-utils/browser";
import {
  BunTestUtilsError as DomBase,
  MissingOptionalDependencyError as DomMissing,
} from "bun-test-utils/dom";
import {
  BunTestUtilsError as PbtBase,
  MissingOptionalDependencyError as PbtMissing,
} from "bun-test-utils/pbt";
import { BunTestUtilsError as SnapshotBase } from "bun-test-utils/snapshot";
import { BunTestUtilsError as StdBase } from "bun-test-utils/std";
import {
  CassetteError,
  BunTestUtilsError as VcrBase,
} from "bun-test-utils/vcr";

test("every subpath re-exports the public base error", () => {
  for (const base of [
    BunTestUtilsError,
    DomBase,
    BrowserBase,
    PbtBase,
    SnapshotBase,
    StdBase,
    VcrBase,
  ]) {
    expect(base.prototype instanceof Error).toBe(true);
    expect(new base("INVALID_API_USAGE", "probe").code).toBe(
      "INVALID_API_USAGE",
    );
  }
});

test("vcr subpath exports CassetteError with stable codes", () => {
  const err = new CassetteError("CALLBACK_NOT_RECORDED", "probe");
  expect(err).toBeInstanceOf(VcrBase);
  expect(err.code).toBe("CALLBACK_NOT_RECORDED");
});

test("dom, browser and pbt subpaths export MissingOptionalDependencyError", () => {
  for (const cls of [DomMissing, BrowserMissing, PbtMissing]) {
    const err = new cls("pkg", "bun add -d pkg", "probe");
    expect(err.code).toBe("MISSING_OPTIONAL_DEPENDENCY");
    expect(err.details).toEqual({
      packageName: "pkg",
      installCommand: "bun add -d pkg",
    });
  }
});
