import { describe, expect, it } from "vitest";
import { buildSetupPlan, type RunnableSetupPlan } from "./setup-plan.js";
import { getOnboardingProgressLabel, getStepAt, STEP_LABELS, STEP_TITLES } from "./steps.js";

function setupPlan(productId: Parameters<typeof buildSetupPlan>[0]): RunnableSetupPlan {
  const plan = buildSetupPlan(productId);
  if (!plan) throw new Error(`Missing setup plan for ${productId}`);
  return plan;
}

describe("setup-plan-derived onboarding steps", () => {
  it("uses transport-neutral copy for every step label", () => {
    expect(STEP_LABELS.authentication).toBe("Authentication");
    expect(STEP_TITLES.authentication).toBe("Configure Authentication");
    expect(Object.keys(STEP_LABELS)).not.toContain("conformance");
    expect(Object.values(STEP_LABELS)).not.toContain("API Key");
    expect(Object.values(STEP_TITLES)).not.toContain("API Key");
  });

  it("formats progress from each plan's actual length and order", () => {
    const hostedPlan = setupPlan("gemini");

    expect(getStepAt(hostedPlan, 1)).toBe("endpoint-binding");
    expect(getOnboardingProgressLabel(hostedPlan, 1)).toBe("Step 2 of 5: Endpoint");
  });

  it("rejects an index outside the selected plan", () => {
    expect(() => getStepAt(setupPlan("gemini"), 5)).toThrow("No onboarding step at index 5");
  });
});
