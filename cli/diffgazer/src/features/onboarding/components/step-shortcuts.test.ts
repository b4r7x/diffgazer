import { test, describe, expect } from "vitest";
import { WIZARD_STEPS, type OnboardingStep } from "@diffgazer/core/onboarding";
import { getStepShortcuts } from "./step-shortcuts";

describe("getStepShortcuts", () => {
  test("returns step-area shortcuts for every wizard step when focus is 'step'", () => {
    for (const step of WIZARD_STEPS) {
      const shortcuts = getStepShortcuts(step, "step", false);
      expect(
        shortcuts.length > 0,
        `expected step '${step}' to expose shortcuts in step focus`,
      ).toBeTruthy();
      const keys = shortcuts.map((shortcut) => shortcut.key);
      expect(
        keys.some((key) => key.includes("↑/↓")),
        `expected step '${step}' to expose navigation hint`,
      ).toBeTruthy();
      expect(
        keys.includes("Tab"),
        `expected step '${step}' to expose Tab focus hint`,
      ).toBeTruthy();
    }
  });

  test("returns nav-area shortcuts when focus is 'nav'", () => {
    const step: OnboardingStep = "storage";
    const shortcuts = getStepShortcuts(step, "nav", false);
    const keys = shortcuts.map((shortcut) => shortcut.key);
    expect(keys.includes("Enter")).toBeTruthy();
    expect(keys.includes("Tab")).toBeTruthy();
  });

  test("marks the action shortcut disabled when the step gate is blocked", () => {
    const disabled = getStepShortcuts("provider", "nav", true);
    const enabled = getStepShortcuts("provider", "nav", false);
    const disabledEntry = disabled.find((s) => s.key === "Enter");
    const enabledEntry = enabled.find((s) => s.key === "Enter");
    expect(disabledEntry?.disabled).toBe(true);
    expect(enabledEntry?.disabled).toBe(false);
  });

  test("analysis step exposes a Space toggle hint distinct from radio steps", () => {
    const analysisKeys = getStepShortcuts("analysis", "step", false).map(
      (shortcut) => shortcut.key,
    );
    expect(analysisKeys.includes("Space")).toBeTruthy();
  });

  test("every step in step-focus exposes a non-disabled Tab shortcut (focus is always available)", () => {
    for (const step of WIZARD_STEPS) {
      const tab = getStepShortcuts(step, "step", false).find((s) => s.key === "Tab");
      expect(tab, `expected step '${step}' to include Tab shortcut`).toBeTruthy();
      expect(tab!.disabled).not.toBe(true);
    }
  });

  test("nav-focus Tab shortcut is independent of the disabled gate", () => {
    const disabledTab = getStepShortcuts("provider", "nav", true).find(
      (s) => s.key === "Tab",
    );
    const enabledTab = getStepShortcuts("provider", "nav", false).find(
      (s) => s.key === "Tab",
    );
    expect(disabledTab?.disabled).not.toBe(true);
    expect(enabledTab?.disabled).not.toBe(true);
  });
});
