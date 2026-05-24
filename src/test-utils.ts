// Shared test helpers for assertion patterns used across the suite.
// Keep tiny and dependency-free so it can be safely imported by any test file.

import { expect, type MockInstance } from "vitest";

/**
 * Returns the Nth call's first argument coerced to string, or "" if the call
 * never happened. Useful for asserting alert/console-error messages without
 * sprinkling `String((spy.mock.calls[N] ?? [""])[0])` everywhere.
 */
export function nthCallFirstArgString(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  spy: MockInstance<any>,
  n = 0,
): string {
  return String((spy.mock.calls[n] ?? [""])[0]);
}

/**
 * Asserts the spy was called exactly `times` times AND the Nth call's first
 * argument matches the given pattern. Combines the two most common alert/error
 * assertion shapes into one line.
 */
export function expectCallWithMessage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  spy: MockInstance<any>,
  pattern: RegExp | string,
  options: { times?: number; callIndex?: number } = {},
): void {
  const times = options.times ?? 1;
  const callIndex = options.callIndex ?? 0;
  expect(spy).toHaveBeenCalledTimes(times);
  const msg = nthCallFirstArgString(spy, callIndex);
  if (pattern instanceof RegExp) {
    expect(msg).toMatch(pattern);
  } else {
    expect(msg).toContain(pattern);
  }
}
