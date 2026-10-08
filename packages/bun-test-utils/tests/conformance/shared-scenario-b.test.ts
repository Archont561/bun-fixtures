import { test } from "@archont561/bun-test-utils";
import { assertSharedFile, withSharedFile } from "./shared/scenario-steps.ts";

withSharedFile(
  test.scenario("the shared scenario sequence works in the second file"),
).then("the imported fixture-backed steps compose again", assertSharedFile);
