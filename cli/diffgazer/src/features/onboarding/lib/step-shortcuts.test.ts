import { type OnboardingStep, WIZARD_STEPS } from "@diffgazer/core/onboarding";
import { describe, expect, test } from "vitest";
import { getStepShortcuts } from "./step-shortcuts";

describe("getStepShortcuts", () => {
  test("returns step-area shortcuts for every wizard step when focus is 'step'", () => {
    for (const step of WIZARD_STEPS) {
      const shortcuts = getStepShortcuts({
        currentStep: step,
        focusArea: "step",
        navIndex: 0,
        isFirstStep: step === "storage",
        isLastStep: step === "execution",
        canProceed: true,
        inputMethod: "paste",
        apiKeyInputFocused: false,
      });
      const keys = shortcuts.map((shortcut) => shortcut.key);
      expect(
        keys.some((key) => key.includes("↑/↓")),
        `expected step '${step}' to expose navigation hint`,
      ).toBeTruthy();
      expect(keys.includes("Tab"), `expected step '${step}' to expose Tab focus hint`).toBeTruthy();
    }
  });

  test("returns nav-area shortcuts when focus is 'nav'", () => {
    const step: OnboardingStep = "storage";
    const shortcuts = getStepShortcuts({
      currentStep: step,
      focusArea: "nav",
      navIndex: 0,
      isFirstStep: true,
      isLastStep: false,
      canProceed: true,
      inputMethod: "paste",
      apiKeyInputFocused: false,
    });
    const keys = shortcuts.map((shortcut) => shortcut.key);
    expect(keys.includes("Enter")).toBeTruthy();
    expect(keys.includes("Tab")).toBeTruthy();
  });

  test("describes and enables Back while Next is blocked", () => {
    const state = {
      currentStep: "provider",
      focusArea: "nav",
      isFirstStep: false,
      isLastStep: false,
      canProceed: false,
      inputMethod: "paste",
      apiKeyInputFocused: false,
    } satisfies Omit<Parameters<typeof getStepShortcuts>[0], "navIndex">;

    const back = getStepShortcuts({ ...state, navIndex: 0 }).find((s) => s.key === "Enter");
    const next = getStepShortcuts({ ...state, navIndex: 1 }).find((s) => s.key === "Enter");

    expect(back).toMatchObject({ label: "Back", disabled: false });
    expect(next).toMatchObject({ label: "Next", disabled: true });

    const firstStepNext = getStepShortcuts({
      ...state,
      currentStep: "storage",
      navIndex: 0,
      isFirstStep: true,
    }).find((shortcut) => shortcut.key === "Enter");
    expect(firstStepNext).toMatchObject({ label: "Next", disabled: true });
  });

  test("describes the focused final action as Complete Setup", () => {
    const complete = getStepShortcuts({
      currentStep: "execution",
      focusArea: "nav",
      navIndex: 1,
      isFirstStep: false,
      isLastStep: true,
      canProceed: true,
      inputMethod: "paste",
      apiKeyInputFocused: false,
    }).find((shortcut) => shortcut.key === "Enter");

    expect(complete).toMatchObject({ label: "Complete Setup", disabled: false });

    const blockedComplete = getStepShortcuts({
      currentStep: "execution",
      focusArea: "nav",
      navIndex: 1,
      isFirstStep: false,
      isLastStep: true,
      canProceed: false,
      inputMethod: "paste",
      apiKeyInputFocused: false,
    }).find((shortcut) => shortcut.key === "Enter");

    expect(blockedComplete).toMatchObject({ label: "Complete Setup", disabled: true });
  });

  test("analysis step exposes a Space toggle hint distinct from radio steps", () => {
    const analysisShortcuts = getStepShortcuts({
      currentStep: "analysis",
      focusArea: "step",
      navIndex: 0,
      isFirstStep: false,
      isLastStep: false,
      canProceed: true,
      inputMethod: "paste",
      apiKeyInputFocused: false,
    });
    expect(analysisShortcuts).toContainEqual({ key: "Space", label: "Toggle Option" });

    for (const step of WIZARD_STEPS.filter((wizardStep) => wizardStep !== "analysis")) {
      const shortcuts = getStepShortcuts({
        currentStep: step,
        focusArea: "step",
        navIndex: 0,
        isFirstStep: step === "storage",
        isLastStep: step === "execution",
        canProceed: true,
        inputMethod: "paste",
        apiKeyInputFocused: false,
      });
      expect(
        shortcuts.some((shortcut) => shortcut.key === "Space"),
        `expected step '${step}' not to expose an exact Space shortcut`,
      ).toBe(false);
    }
  });

  test("every step in step-focus exposes a non-disabled Tab shortcut (focus is always available)", () => {
    for (const step of WIZARD_STEPS) {
      const tab = getStepShortcuts({
        currentStep: step,
        focusArea: "step",
        navIndex: 0,
        isFirstStep: step === "storage",
        isLastStep: step === "execution",
        canProceed: false,
        inputMethod: "paste",
        apiKeyInputFocused: false,
      }).find((s) => s.key === "Tab");
      expect(tab, `expected step '${step}' to include Tab shortcut`).toBeTruthy();
      if (!tab) throw new Error(`step '${step}' missing Tab shortcut`);
      expect(tab.disabled).not.toBe(true);
    }
  });

  test("nav-focus Tab shortcut is independent of the focused action gate", () => {
    const state = {
      currentStep: "provider",
      focusArea: "nav",
      navIndex: 1,
      isFirstStep: false,
      isLastStep: false,
      inputMethod: "paste",
      apiKeyInputFocused: false,
    } satisfies Omit<Parameters<typeof getStepShortcuts>[0], "canProceed">;
    const disabledTab = getStepShortcuts({ ...state, canProceed: false }).find(
      (s) => s.key === "Tab",
    );
    const enabledTab = getStepShortcuts({ ...state, canProceed: true }).find(
      (s) => s.key === "Tab",
    );
    expect(disabledTab?.disabled).not.toBe(true);
    expect(enabledTab?.disabled).not.toBe(true);
  });

  test("describes the API-key Tab destination for the active method and zone", () => {
    const state = {
      currentStep: "api-key",
      focusArea: "step",
      navIndex: 0,
      isFirstStep: false,
      isLastStep: false,
      canProceed: true,
      apiKeyInputFocused: false,
    } satisfies Omit<Parameters<typeof getStepShortcuts>[0], "inputMethod">;

    const pasteShortcuts = getStepShortcuts({ ...state, inputMethod: "paste" });
    const envShortcuts = getStepShortcuts({ ...state, inputMethod: "env" });
    const pasteTab = pasteShortcuts.find((shortcut) => shortcut.key === "Tab");
    const envTab = envShortcuts.find((shortcut) => shortcut.key === "Tab");
    const inputShortcuts = getStepShortcuts({
      ...state,
      inputMethod: "paste",
      apiKeyInputFocused: true,
    });

    expect(pasteTab?.label).toBe("Focus Input");
    expect(envTab?.label).toBe("Focus Actions");
    expect(envShortcuts).toContainEqual({ key: "↑/↓", label: "Navigate Methods" });
    expect(inputShortcuts).toEqual([{ key: "Tab", label: "Focus Actions" }]);
  });
});
