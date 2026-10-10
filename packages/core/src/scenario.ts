/**
 * BDD scenario integration (split out of plugin.ts — audit 2026-10-06,
 * finding 3): the fluent given/when/then chain and the step executor.
 *
 * `scenarioFactory` receives the runner factory as a parameter instead of
 * importing it, so the module graph stays strictly layered (factory →
 * scenario, never the reverse).
 */

import { expect as bunExpect } from "bun:test";
import { detectFixtures } from "./detect.ts";
import type {
  FixtureMap,
  ScenarioChain,
  ScenarioContext,
  ScenarioFactory,
  TestFn,
} from "./types.ts";

/** The runner factory the chain registers its test with (see factory.ts). */
export type MakeTest = (file: string, map: FixtureMap) => TestFn;

type Step = {
  phase: "given" | "when" | "then";
  name: string;
  fn: (ctx: ScenarioContext<any>) => unknown;
};

export async function executeScenarioSteps(
  steps: Array<{
    phase: "given" | "when" | "then";
    fn: (ctx: ScenarioContext<any>) => unknown;
  }>,
  context: ScenarioContext<any>,
): Promise<void> {
  for (const step of steps) {
    const result = await step.fn(context);
    if (step.phase !== "then" && result && typeof result === "object") {
      Object.assign(context, result);
    }
  }
}

export function scenarioFactory(
  file: string,
  map: FixtureMap,
  makeTest: MakeTest,
): ScenarioFactory {
  const create = <S extends object = Record<string, unknown>>(
    title: string,
  ): ScenarioChain<S> => {
    const steps: Step[] = [];
    let registered = false;

    const chain = {
      given(name: string, fn: (ctx: ScenarioContext<any>) => unknown) {
        if (steps.some((step) => step.phase !== "given"))
          throw new Error(
            "[bun-test-utils] scenario given() must precede when() and then()",
          );
        steps.push({ phase: "given", name, fn });
        return chain;
      },
      when(name: string, fn: (ctx: ScenarioContext<any>) => unknown) {
        if (steps.some((step) => step.phase === "then"))
          throw new Error(
            "[bun-test-utils] scenario when() must precede then()",
          );
        steps.push({ phase: "when", name, fn });
        return chain;
      },
      // biome-ignore lint/suspicious/noThenProperty: `then` is the intentional fluent scenario phase.
      then(name: string, fn: (ctx: ScenarioContext<any>) => unknown) {
        steps.push({ phase: "then", name, fn });
        if (!registered) {
          registered = true;
          makeTest(file, map)(
            title,
            async (fixtures: ScenarioContext<any>) => {
              const context = Object.assign(fixtures, { expect: bunExpect });
              await executeScenarioSteps(steps, context);
            },
            {
              fixtures: [
                ...new Set(
                  steps
                    .flatMap((step) => detectFixtures(step.fn, 0))
                    .filter((name) => name in map),
                ),
              ],
            },
          );
        }
        return chain;
      },
    } as ScenarioChain<S>;
    return chain;
  };

  const factory = create as ScenarioFactory;
  factory.prop = (title, _strategies) => {
    throw new Error(
      `[bun-test-utils] scenario.prop(${title}) requires the property-test integration; use test.prop() for property tests`,
    );
  };
  return factory;
}
