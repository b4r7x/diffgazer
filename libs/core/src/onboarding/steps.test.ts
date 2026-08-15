import { describe, expect, it } from "vitest";
import { buildSetupPlan, type RunnableSetupPlan } from "./setup-plan.js";
import { getOnboardingProgressLabel, getStepAt, STEP_LABELS, STEP_TITLES } from "./steps.js";

function setupPlan(productId: Parameters<typeof buildSetupPlan>[0]): RunnableSetupPlan {
  const plan = buildSetupPlan(productId);
  if (!plan) throw new Error(`Missing setup plan for ${productId}`);
  return plan;
}

describe("setup-plan-derived onboarding steps", () => {
  it("uses transport-neutral copy and never presents local setup as an API-key step", () => {
    const localPlan = setupPlan("local-openai");

    expect(localPlan.kind).toBe("runnable");
    expect(localPlan.requiredFields).not.toContain("credential");
    expect(STEP_LABELS.authentication).toBe("Authentication");
    expect(STEP_TITLES.authentication).toBe("Configure Authentication");
    expect(STEP_LABELS.conformance).toBe("Conformance");
    expect(STEP_TITLES.conformance).toBe("Verify Conformance");
    expect(Object.values(STEP_LABELS)).not.toContain("API Key");
    expect(Object.values(STEP_TITLES)).not.toContain("API Key");
  });

  it("formats progress from each plan's actual length and order", () => {
    const hostedPlan = setupPlan("gemini");
    const cliPlan = setupPlan("codex-cli");

    expect(getStepAt(hostedPlan, 1)).toBe("endpoint-binding");
    expect(getOnboardingProgressLabel(hostedPlan, 1)).toBe("Step 2 of 6: Endpoint");
    expect(getStepAt(cliPlan, 1)).toBe("authentication");
    expect(getOnboardingProgressLabel(cliPlan, 1)).toBe("Step 2 of 5: Authentication");
  });

  it("rejects an index outside the selected plan", () => {
    expect(() => getStepAt(setupPlan("codex-cli"), 5)).toThrow("No onboarding step at index 5");
  });
});
