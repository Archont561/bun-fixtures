import type {
  GivenChain,
  GivenStep,
  ScenarioContext,
  ThenStep,
  WhenStep,
} from "bun-test-utils/bdd";
import type {
  ArbitraryInput,
  FastCheckApi,
  GeneratedValues,
} from "bun-test-utils/pbt";
import type { Arbitrary } from "fast-check";

// Positive assertions pin the runtime helper name and related types to the PBT subpath.
type _DefineArbitrariesIsExported =
  typeof import("bun-test-utils/pbt").defineArbitraries;
// @ts-expect-error The pre-release propTestSchema name has been removed.
type _OldPbtName = typeof import("bun-test-utils/pbt").propTestSchema;

type _PbtAliasesAreExported = [
  FastCheckApi,
  ArbitraryInput<{ value: Arbitrary<string> }>,
  GeneratedValues<{ value: Arbitrary<string> }>,
];
type _BddAliasesAreExported = [
  GivenChain,
  GivenStep,
  WhenStep,
  ThenStep,
  ScenarioContext,
];

// @ts-expect-error PBT type helpers are available only from bun-test-utils/pbt.
import type { FastCheckApi as RootFastCheckApi } from "bun-test-utils";

type _RootFastCheckApiMustBeUnavailable = RootFastCheckApi;

// @ts-expect-error PBT type helpers are available only from bun-test-utils/pbt.
import type { ArbitraryInput as RootArbitraryInput } from "bun-test-utils";

type _RootArbitraryInputMustBeUnavailable = RootArbitraryInput<{
  value: Arbitrary<string>;
}>;

// @ts-expect-error PBT type helpers are available only from bun-test-utils/pbt.
import type { GeneratedValues as RootGeneratedValues } from "bun-test-utils";

type _RootGeneratedValuesMustBeUnavailable = RootGeneratedValues<{
  value: Arbitrary<string>;
}>;

// @ts-expect-error Scenario step types are available only from bun-test-utils/bdd.
import type { GivenChain as RootGivenChain } from "bun-test-utils";

type _RootGivenChainMustBeUnavailable = RootGivenChain;

// @ts-expect-error Scenario step types are available only from bun-test-utils/bdd.
import type { ScenarioContext as RootScenarioContext } from "bun-test-utils";

type _RootScenarioContextMustBeUnavailable = RootScenarioContext;

// @ts-expect-error Scenario step types are available only from bun-test-utils/bdd.
import type { GivenStep as RootGivenStep } from "bun-test-utils";

type _RootGivenStepMustBeUnavailable = RootGivenStep;

// @ts-expect-error Scenario step types are available only from bun-test-utils/bdd.
import type { WhenStep as RootWhenStep } from "bun-test-utils";

type _RootWhenStepMustBeUnavailable = RootWhenStep;

// @ts-expect-error Scenario step types are available only from bun-test-utils/bdd.
import type { ThenStep as RootThenStep } from "bun-test-utils";

type _RootThenStepMustBeUnavailable = RootThenStep;
