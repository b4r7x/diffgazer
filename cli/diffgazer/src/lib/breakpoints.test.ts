import { describe, expect, test } from "vitest";
import { buildResponsiveResult, getBreakpointTier } from "./breakpoints";

describe("terminal breakpoints", () => {
  test.each([
    [79, "narrow"],
    [80, "medium"],
    [119, "medium"],
    [120, "wide"],
  ] as const)("maps %i columns to the %s tier", (columns, tier) => {
    expect(getBreakpointTier(columns)).toBe(tier);
  });

  test.each(["narrow", "medium", "wide"] as const)("sets only the %s responsive flag", (tier) => {
    const result = buildResponsiveResult(tier);

    expect(result).toEqual({
      tier,
      isNarrow: tier === "narrow",
      isMedium: tier === "medium",
      isWide: tier === "wide",
    });
  });
});
