import { describe, expect, it } from "vitest";
import { STEP_LABELS, STEP_TITLES } from "./steps.js";
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
});
