import { setSystemTime } from "bun:test";
import { createFixture } from "@bun-test-utils/core";

export type ClockTime = string | number | Date;

export interface ClockHelper {
  /** Freezes the system clock at the supplied instant. */
  freeze(time: ClockTime): void;
  /** Moves the frozen system clock to another instant. */
  set(time: ClockTime): void;
  /** Returns the current (possibly frozen) time. */
  now(): Date;
}

function asDate(time: ClockTime): Date {
  return time instanceof Date ? time : new Date(time);
}

export const clockFixture = createFixture<ClockHelper>({
  scope: "test",
  setup: async (use) => {
    const set = (time: ClockTime) => setSystemTime(asDate(time));
    try {
      await use({ freeze: set, set, now: () => new Date() });
    } finally {
      setSystemTime();
    }
  },
});
