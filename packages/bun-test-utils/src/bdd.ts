import type { GivenStep, ThenStep, WhenStep } from "@bun-test-utils/core";

export type {
  GivenChain,
  GivenStep,
  ScenarioContext,
  ThenStep,
  WhenStep,
} from "@bun-test-utils/core";

/** Return a `given` step unchanged while contextually typing its input and state. */
export function givenStep<Context extends object, Added extends object>(
  step: GivenStep<Context, Added>,
): GivenStep<Context, Added> {
  return step;
}

/** Return a `when` step unchanged while contextually typing its input and state. */
export function whenStep<Context extends object, Added extends object>(
  step: WhenStep<Context, Added>,
): WhenStep<Context, Added> {
  return step;
}

/** Return a `then` step unchanged while contextually typing its input state. */
export function thenStep<Context extends object>(
  step: ThenStep<Context>,
): ThenStep<Context> {
  return step;
}
