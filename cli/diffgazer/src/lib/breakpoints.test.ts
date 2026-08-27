import { describe, expect, test } from "vitest";
import { buildResponsiveResult, getBreakpointTier, isCompactHeight } from "./breakpoints";

describe("terminal breakpoints", () => {
  test.each([
    [79, "narrow"],
    [80, "medium"],
    [119, "medium"],
    [120, "wide"],
  ] as const)("maps %i columns to the %s tier", (columns, tier) => {
    expect(getBreakpointTier(columns)).toBe(tier);
  });

  test.each([
    ["narrow", { tier: "narrow", isNarrow: true, isMedium: false, isWide: false }],
    ["medium", { tier: "medium", isNarrow: false, isMedium: true, isWide: false }],
    ["wide", { tier: "wide", isNarrow: false, isMedium: false, isWide: true }],
  ] as const)("sets only the %s responsive flag", (tier, expected) => {
    expect(buildResponsiveResult(tier)).toEqual(expected);
  });

  test.each([
    [23, true],
    [24, true],
    [25, false],
  ] as const)("treats %i rows as compact=%s", (rows, compact) => {
    expect(isCompactHeight(rows)).toBe(compact);
  });
});
