/**
 * @vitest-environment jsdom
 */
import { describe, expect, test } from "vitest";
import { getNextEnabledAction } from "./use-action-row";

describe("getNextEnabledAction", () => {
  test("skips disabled actions and clamps at both boundaries", () => {
    const options = { actionCount: 4, disabledActions: [false, true, false, false] };

    expect(getNextEnabledAction({ ...options, current: 0, direction: 1 })).toBe(2);
    expect(getNextEnabledAction({ ...options, current: 2, direction: -1 })).toBe(0);
    expect(getNextEnabledAction({ ...options, current: 0, direction: -1 })).toBe(0);
    expect(getNextEnabledAction({ ...options, current: 3, direction: 1 })).toBe(3);
  });
});
