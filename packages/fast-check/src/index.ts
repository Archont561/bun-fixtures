import {
  test as baseTest,
  createTest,
  describe,
  expect,
  type FixtureContext,
} from "bun-fixture";
import fc, {
  type Arbitrary,
  type Parameters as FcParameters,
} from "fast-check";

export type { Arbitrary } from "fast-check";
export { describe, expect, fc };

export interface PropTestOptions extends FcParameters {
  fixtures?: string[];
  timeout?: number;
}

export type ArbitraryRecord = Record<string, Arbitrary<any>>;
export type GeneratedValues<T extends ArbitraryRecord> = {
  [K in keyof T]: T[K] extends Arbitrary<infer U> ? U : never;
};

export type PropTestFn<T extends ArbitraryRecord = ArbitraryRecord> = (
  fixtures: FixtureContext,
  values: GeneratedValues<T>,
) => void | Promise<void>;

/**
 * Creates a property test runner bound to a specific file or caller file.
 */
export function createPropTest(testFile?: string) {
  const runner = createTest(testFile);

  function prop<T extends ArbitraryRecord>(
    title: string,
    arbs: T,
    testFn: PropTestFn<T>,
    opts?: PropTestOptions,
  ) {
    const recordArb = fc.record(arbs) as Arbitrary<GeneratedValues<T>>;
    const { fixtures, timeout, ...fcOpts } = opts ?? {};

    runner.test(
      title,
      async (ctx: FixtureContext) => {
        const property = fc.asyncProperty(
          recordArb,
          async (generated: GeneratedValues<T>) => {
            await testFn(ctx, generated);
          },
        );
        await fc.assert(property as any, fcOpts);
      },
      { fixtures, timeout },
    );
  }

  return {
    ...runner,
    prop,
    fc,
  };
}

const defaultPropRunner = createPropTest();

export const prop = defaultPropRunner.prop;
export const test = Object.assign(baseTest, {
  prop: defaultPropRunner.prop,
});

export default {
  fc,
  prop,
  test,
  describe,
  expect,
  createPropTest,
};
