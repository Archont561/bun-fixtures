import type { FastCheckApi } from "@bun-test-utils/pbt";

export type {
  ArbitraryInput,
  FastCheckApi,
  GeneratedValues,
} from "@bun-test-utils/pbt";

type ArbitraryRecord = Record<string, import("fast-check").Arbitrary<unknown>>;

/**
 * Type a reusable fast-check arbitrary record without loading the PBT runner.
 * Factories receive contextual typing for `fc`; the supplied value is returned
 * unchanged for use with `test.prop` or `test.scenario.prop`.
 */
export function defineArbitraries<T extends ArbitraryRecord>(
  arbitraries: (fc: FastCheckApi) => T,
): (fc: FastCheckApi) => T;
export function defineArbitraries<T extends ArbitraryRecord>(arbitraries: T): T;
export function defineArbitraries(
  arbitraries: ArbitraryRecord | ((fc: FastCheckApi) => ArbitraryRecord),
): ArbitraryRecord | ((fc: FastCheckApi) => ArbitraryRecord) {
  return arbitraries;
}
