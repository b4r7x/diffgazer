import { getInitialWizardData, type OnboardingStep } from "@diffgazer/core/onboarding";
import { describe, expect, test } from "vitest";
import { getStepShortcuts } from "./step-shortcuts";

const HOSTED_STEPS = getInitialWizardData("gemini").plan.steps.map((step) => step.id);
const CLI_STEPS = getInitialWizardData("codex-cli").plan.steps.map((step) => step.id);

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
        transportFamily: "hosted-api",
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

  test("omits hosted credential shortcuts for local HTTP authentication", () => {
    const shortcuts = getStepShortcuts({
      currentStep: "authentication",
      focusArea: "step",
      navIndex: 0,
      isFirstStep: false,
      isLastStep: false,
      canProceed: true,
      inputMethod: "paste",
      apiKeyInputFocused: false,
      transportFamily: "local-http",
    });
    expect(shortcuts).toEqual([{ key: "Tab", label: "Focus Actions" }]);
  });

  test("omits hosted credential shortcuts for local CLI authentication", () => {
    const shortcuts = getStepShortcuts({
      currentStep: "authentication",
      focusArea: "step",
      navIndex: 0,
      isFirstStep: false,
      isLastStep: false,
      canProceed: true,
      inputMethod: "paste",
      apiKeyInputFocused: false,
      transportFamily: "local-cli",
    });
    expect(shortcuts).toEqual([{ key: "Tab", label: "Focus Actions" }]);
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
      transportFamily: "hosted-api",
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
      transportFamily: "hosted-api",
    }).find((shortcut) => shortcut.key === "Tab");

    expect(pasteTab?.label).toBe("Focus Input");
    expect(envTab?.label).toBe("Focus Actions");
  });

  test("covers every CLI step through to acknowledgement", () => {
    for (const step of CLI_STEPS) {
      const shortcuts = getStepShortcuts({
        currentStep: step as OnboardingStep,
        focusArea: "step",
        navIndex: 0,
        isFirstStep: step === "product",
        isLastStep: step === "acknowledgement",
        canProceed: true,
        inputMethod: "paste",
        apiKeyInputFocused: false,
        transportFamily: "local-cli",
      });
      expect(shortcuts.length).toBeGreaterThan(0);
    }
  });
});
