import { describe, expect, it } from "vitest";
import { PLANNING_OUTPUT_TOKENS } from "../ai/budget/cost.js";
import { budgetWithinModelObservation } from "./budget-ceiling.js";
import type { ConfigurationBudgetLimits } from "./provider-config.js";

const BUDGET: ConfigurationBudgetLimits = {
  inputTokens: 200_000,
  responseBytes: 8_000_000,
  wallTimeMs: 300_000,
  retries: 1,
  concurrency: 1,
  perReview: 5,
};

describe("budgetWithinModelObservation", () => {
  it("reserves only the planned answer length out of a large catalog ceiling", () => {
    const clamped = budgetWithinModelObservation(BUDGET, {
      contextTokens: 131_072,
      outputTokens: 98_304,
    });

    expect(PLANNING_OUTPUT_TOKENS).toBe(32_768);
    expect(clamped.inputTokens).toBe(131_072 - PLANNING_OUTPUT_TOKENS);
  });

  it("reserves a catalog ceiling that is below the planned answer length in full", () => {
    const clamped = budgetWithinModelObservation(BUDGET, {
      contextTokens: 131_072,
      outputTokens: 8_192,
    });

    expect(clamped.inputTokens).toBe(122_880);
  });
});
