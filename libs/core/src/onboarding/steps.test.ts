import { describe, expect, it } from "vitest";
import { getOnboardingProgressLabel, STEP_LABELS, STEP_TITLES } from "./steps.js";
import { WIZARD_STEPS } from "./types.js";

describe("onboarding step copy", () => {
  it("covers every wizard step with a label and title", () => {
    for (const step of WIZARD_STEPS) {
      expect(STEP_LABELS[step]).toBeTruthy();
      expect(STEP_TITLES[step]).toBeTruthy();
    }
  });

  it("keeps the canonical onboarding wording", () => {
    expect(STEP_TITLES.storage).toBe("Secrets Storage");
    expect(STEP_TITLES.provider).toBe("AI Provider");
    expect(STEP_LABELS.model).toBe("Model");
    expect(STEP_LABELS.execution).toBe("Execution");
  });

  it("formats a compact current-step label without splitting step names", () => {
    expect(getOnboardingProgressLabel(0)).toBe("Step 1 of 6: Storage");
    expect(getOnboardingProgressLabel(2)).toBe("Step 3 of 6: API Key");
    expect(getOnboardingProgressLabel(5)).toBe("Step 6 of 6: Execution");
  });
});
