import { describe, expect, it } from "vitest";
import { buildSetupPlan, type SetupPlan } from "./setup-plan.js";
import { getOnboardingProgressLabel, getStepAt, STEP_LABELS, STEP_TITLES } from "./steps.js";

function setupPlan(productId: Parameters<typeof buildSetupPlan>[0]): SetupPlan {
  const plan = buildSetupPlan(productId);
  if (!plan) throw new Error(`Missing setup plan for ${productId}`);
  return plan;
}

describe("setup-plan-derived onboarding steps", () => {
  it("derives hosted, local HTTP, and local CLI order from each product plan", () => {
    expect(setupPlan("gemini").steps.map((step) => step.id)).toEqual([
      "product",
      "endpoint-binding",
      "authentication",
      "model",
      "conformance",
      "acknowledgement",
    ]);
    expect(setupPlan("local-openai").steps.map((step) => step.id)).toEqual([
      "product",
      "endpoint-binding",
      "authentication",
      "model",
      "conformance",
      "acknowledgement",
    ]);
    expect(setupPlan("codex-cli").steps.map((step) => step.id)).toEqual([
      "product",
      "authentication",
      "model",
      "conformance",
      "acknowledgement",
    ]);
  });

  it("uses transport-neutral copy and never presents local setup as an API-key step", () => {
    const localPlan = setupPlan("local-openai");

    expect(localPlan.kind).toBe("runnable");
    if (localPlan.kind !== "runnable") throw new Error("Expected runnable local plan");
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
    const removedPlan = setupPlan("zai-coding");

    expect(getStepAt(hostedPlan, 1)).toBe("endpoint-binding");
    expect(getOnboardingProgressLabel(hostedPlan, 1)).toBe("Step 2 of 6: Endpoint");
    expect(getStepAt(cliPlan, 1)).toBe("authentication");
    expect(getOnboardingProgressLabel(cliPlan, 1)).toBe("Step 2 of 5: Authentication");
    expect(getOnboardingProgressLabel(removedPlan, 0)).toBe("Step 1 of 2: Migration");
    expect(getOnboardingProgressLabel(removedPlan, 1)).toBe("Step 2 of 2: Delete");
  });

  it("rejects an index outside the selected plan", () => {
    expect(() => getStepAt(setupPlan("codex-cli"), 5)).toThrow("No onboarding step at index 5");
  });
});
