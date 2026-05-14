import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { getCompatibilityLabel } from "./model-select-helpers.js";

describe("getCompatibilityLabel", () => {
  test("reports no models available when total is zero", () => {
    assert.equal(
      getCompatibilityLabel({ total: 0, compatible: 0, hasParams: false }),
      "No models available.",
    );
  });

  test("reports filtered compatibility ratio when compatible < total", () => {
    assert.equal(
      getCompatibilityLabel({ total: 100, compatible: 42, hasParams: true }),
      "Showing 42/100 models that support structured outputs.",
    );
  });

  test("reports full compatibility when all models match", () => {
    assert.equal(
      getCompatibilityLabel({ total: 5, compatible: 5, hasParams: true }),
      "Showing models that support structured outputs.",
    );
  });

  test("reports unknown compatibility when no model exposes params", () => {
    assert.equal(
      getCompatibilityLabel({ total: 5, compatible: 5, hasParams: false }),
      "Compatibility unknown; showing all models.",
    );
  });
});
