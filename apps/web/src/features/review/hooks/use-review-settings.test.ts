import { describe, it, expect } from "vitest";
import { LensIdSchema } from "@stargazer/schemas/review";

// Test the LensId validation logic used in use-review-settings.
// The hook itself wraps useSettings, so we test the pure validation logic.

describe("LensId validation", () => {
  it("should accept valid lens IDs", () => {
    expect(LensIdSchema.safeParse("correctness").success).toBe(true);
    expect(LensIdSchema.safeParse("security").success).toBe(true);
    expect(LensIdSchema.safeParse("performance").success).toBe(true);
    expect(LensIdSchema.safeParse("simplicity").success).toBe(true);
    expect(LensIdSchema.safeParse("tests").success).toBe(true);
  });

  it("should reject invalid lens IDs", () => {
    expect(LensIdSchema.safeParse("invalid").success).toBe(false);
    expect(LensIdSchema.safeParse("").success).toBe(false);
    expect(LensIdSchema.safeParse("CORRECTNESS").success).toBe(false);
  });

  it("should reject non-string values", () => {
    expect(LensIdSchema.safeParse(123).success).toBe(false);
    expect(LensIdSchema.safeParse(null).success).toBe(false);
    expect(LensIdSchema.safeParse(undefined).success).toBe(false);
  });

  it("should filter valid lenses from mixed array", () => {
    const input = ["correctness", "invalid", "security", "bad"];
    const validLenses = input.filter(
      (lens) => LensIdSchema.safeParse(lens).success
    );
    expect(validLenses).toEqual(["correctness", "security"]);
  });
});
