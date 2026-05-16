import { test, describe, expect } from "vitest";
import { getCompatibilityLabel } from "./model-select-helpers.js";

describe("getCompatibilityLabel", () => {
  test("reports no models available when total is zero", () => {
    expect(getCompatibilityLabel({ total: 0, compatible: 0, hasParams: false })).toBe(
      "No models available.",
    );
  });

  test("reports filtered compatibility ratio when compatible < total", () => {
    expect(getCompatibilityLabel({ total: 100, compatible: 42, hasParams: true })).toBe(
      "Showing 42/100 models that support structured outputs.",
    );
  });

  test("reports full compatibility when all models match", () => {
    expect(getCompatibilityLabel({ total: 5, compatible: 5, hasParams: true })).toBe(
      "Showing models that support structured outputs.",
    );
  });

  test("reports unknown compatibility when no model exposes params", () => {
    expect(getCompatibilityLabel({ total: 5, compatible: 5, hasParams: false })).toBe(
      "Compatibility unknown; showing all models.",
    );
  });
});
