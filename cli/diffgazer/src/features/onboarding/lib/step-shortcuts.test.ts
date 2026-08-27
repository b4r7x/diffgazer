import { getInitialWizardData } from "@diffgazer/core/onboarding";
import { describe, expect, test } from "vitest";
import { getStepShortcuts } from "./step-shortcuts";

const HOSTED_STEPS = getInitialWizardData("gemini").plan.steps.map((step) => step.id);

describe("getStepShortcuts", () => {
  test("returns step-area shortcuts for every hosted wizard step when focus is 'step'", () => {
    for (const step of HOSTED_STEPS) {
      const shortcuts = getStepShortcuts({
        currentStep: step,
        focusArea: "step",
        navIndex: 0,
        isFirstStep: step === "product",
        isLastStep: step === "acknowledgement",
        canProceed: true,
        inputMethod: "paste",
        apiKeyInputFocused: false,
      });
      expect(shortcuts.some((shortcut) => shortcut.key === "Tab")).toBe(true);
    }
  });

  test("returns nav-area shortcuts when focus is 'nav'", () => {
    const shortcuts = getStepShortcuts({
      currentStep: "product",
      focusArea: "nav",
      navIndex: 0,
      isFirstStep: true,
      isLastStep: false,
      canProceed: true,
      inputMethod: "paste",
      apiKeyInputFocused: false,
    });
    expect(shortcuts.map((shortcut) => shortcut.key)).toEqual(
      expect.arrayContaining(["Enter", "Tab"]),
    );
  });

  test("labels the arrows as leaving the field while the api key input is focused", () => {
    const shortcuts = getStepShortcuts({
      currentStep: "authentication",
      focusArea: "step",
      navIndex: 0,
      isFirstStep: false,
      isLastStep: false,
      canProceed: true,
      inputMethod: "paste",
      apiKeyInputFocused: true,
    });
    expect(shortcuts).toContainEqual({ key: "↑/↓", label: "Leave Field" });
    expect(shortcuts.map((shortcut) => shortcut.label)).not.toContain("Navigate Methods");
  });

  test("describes the hosted authentication Tab destination for paste vs env", () => {
    const pasteTab = getStepShortcuts({
      currentStep: "authentication",
      focusArea: "step",
      navIndex: 0,
      isFirstStep: false,
      isLastStep: false,
      canProceed: true,
      inputMethod: "paste",
      apiKeyInputFocused: false,
    }).find((shortcut) => shortcut.key === "Tab");
    const envTab = getStepShortcuts({
      currentStep: "authentication",
      focusArea: "step",
      navIndex: 0,
      isFirstStep: false,
      isLastStep: false,
      canProceed: true,
      inputMethod: "env",
      apiKeyInputFocused: false,
    }).find((shortcut) => shortcut.key === "Tab");

    expect(pasteTab?.label).toBe("Focus Input");
    expect(envTab?.label).toBe("Focus Actions");
  });
});
