/**
 * Step definitions for the behavioural suite (`features/*.feature`).
 *
 * Every step works through the public surface of the package: files on disk,
 * `bun test`, and the CLI. Nothing imports the engine directly, so these tests
 * fail if the *behaviour* changes, not if the internals move.
 */
import { expect } from "bun:test";
import { withState } from "@aboviq/bun-test-cucumber";

import {
  countOccurrences,
  createBareProject,
  createProject,
  type Project,
  projectFileExists,
  type RunResult,
  readProjectFile,
  removeProject,
  runCli,
  runTests,
  writeProjectFile,
} from "@/tests/support/project.ts";

interface World {
  project?: Project;
  lastRun?: RunResult;
}

const { Given, When, Then, After } = withState<World>();

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function theProject(state: World): Project {
  if (!state.project)
    throw new Error("no scratch project — missing a Given step?");
  return state.project;
}

function theRun(state: World): RunResult {
  if (!state.lastRun)
    throw new Error("nothing has been run yet — missing a When step?");
  return state.lastRun;
}

/** Structural shape of a Gherkin step argument — avoids depending on @cucumber/messages. */
type StepArgument = { docString?: { content?: string } } | undefined;

function docString(argument: StepArgument): string {
  const content = argument?.docString?.content;
  if (content === undefined) throw new Error("this step requires a docstring");
  return content;
}

/* -------------------------------------------------------------------------- */
/* Given                                                                      */
/* -------------------------------------------------------------------------- */

Given("a project with bun-test-utils preloaded", (state) => ({
  ...state,
  project: createProject(),
}));

Given("a project without bunfig.toml", (state) => ({
  ...state,
  project: createBareProject(),
}));

Given("the file {string}:", (state, [path], argument) => {
  writeProjectFile(theProject(state), path, docString(argument));
  return state;
});

/* -------------------------------------------------------------------------- */
/* When                                                                       */
/* -------------------------------------------------------------------------- */

When("I run the test suite", (state) => ({
  ...state,
  lastRun: runTests(theProject(state)),
}));

When("I run {string}", (state, [args]) => ({
  ...state,
  lastRun: runCli(theProject(state), args.split(/\s+/).filter(Boolean)),
}));

/* -------------------------------------------------------------------------- */
/* Then — test runs                                                           */
/* -------------------------------------------------------------------------- */

Then("{int} test(s) pass(es)", (state, [count]) => {
  const run = theRun(state);
  expect(run.output).toContain(`${count} pass`);
  expect(run.output).toContain("0 fail");
  expect(run.exitCode).toBe(0);
  return state;
});

Then("the test run fails", (state) => {
  expect(theRun(state).exitCode).not.toBe(0);
  return state;
});

Then("the command succeeds", (state) => {
  expect(theRun(state).exitCode).toBe(0);
  return state;
});

/* -------------------------------------------------------------------------- */
/* Then — output                                                              */
/* -------------------------------------------------------------------------- */

Then("the output contains {string}", (state, [needle]) => {
  expect(theRun(state).output).toContain(needle);
  return state;
});

Then("the output contains {string} {int} time(s)", (state, [needle, times]) => {
  expect(countOccurrences(theRun(state).output, needle)).toBe(times);
  return state;
});

Then("{string} comes before {string}", (state, [first, second]) => {
  const { output } = theRun(state);
  const firstAt = output.indexOf(first);
  const secondAt = output.indexOf(second);
  expect(firstAt).toBeGreaterThanOrEqual(0);
  expect(secondAt).toBeGreaterThanOrEqual(0);
  expect(firstAt).toBeLessThan(secondAt);
  return state;
});

/* -------------------------------------------------------------------------- */
/* Then — files                                                               */
/* -------------------------------------------------------------------------- */

Then("the file {string} exists", (state, [path]) => {
  expect(projectFileExists(theProject(state), path)).toBe(true);
  return state;
});

Then("the file {string} contains {string}", (state, [path, needle]) => {
  expect(readProjectFile(theProject(state), path)).toContain(needle);
  return state;
});

Then(
  "{string} contains {string} {int} time(s)",
  (state, [path, needle, times]) => {
    expect(
      countOccurrences(readProjectFile(theProject(state), path), needle),
    ).toBe(times);
    return state;
  },
);

/* -------------------------------------------------------------------------- */
/* Cleanup                                                                    */
/* -------------------------------------------------------------------------- */

After((state) => {
  if (state.project) removeProject(state.project);
  return { ...state, project: undefined, lastRun: undefined };
});
