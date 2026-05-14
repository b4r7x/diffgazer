import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { WIZARD_STEPS, type OnboardingStep } from "@diffgazer/core/onboarding";
import { getStepShortcuts } from "./step-shortcuts.js";

describe("getStepShortcuts", () => {
  test("returns step-area shortcuts for every wizard step when focus is 'step'", () => {
    for (const step of WIZARD_STEPS) {
      const shortcuts = getStepShortcuts(step, "step", false);
      assert.ok(
        shortcuts.length > 0,
        `expected step '${step}' to expose shortcuts in step focus`,
      );
      const keys = shortcuts.map((shortcut) => shortcut.key);
      assert.ok(
        keys.some((key) => key.includes("↑/↓")),
        `expected step '${step}' to expose navigation hint`,
      );
      assert.ok(
        keys.includes("Tab"),
        `expected step '${step}' to expose Tab focus hint`,
      );
    }
  });

  test("returns nav-area shortcuts when focus is 'nav'", () => {
    const step: OnboardingStep = "storage";
    const shortcuts = getStepShortcuts(step, "nav", false);
    const keys = shortcuts.map((shortcut) => shortcut.key);
    assert.ok(keys.includes("Enter"));
    assert.ok(keys.includes("Tab"));
  });

  test("marks the action shortcut disabled when the step gate is blocked", () => {
    const disabled = getStepShortcuts("provider", "nav", true);
    const enabled = getStepShortcuts("provider", "nav", false);
    const disabledEntry = disabled.find((s) => s.key === "Enter");
    const enabledEntry = enabled.find((s) => s.key === "Enter");
    assert.equal(disabledEntry?.disabled, true);
    assert.equal(enabledEntry?.disabled, false);
  });

  test("analysis step exposes a Space toggle hint distinct from radio steps", () => {
    const analysisKeys = getStepShortcuts("analysis", "step", false).map(
      (shortcut) => shortcut.key,
    );
    assert.ok(analysisKeys.includes("Space"));
  });

  test("every step in step-focus exposes a non-disabled Tab shortcut (focus is always available)", () => {
    for (const step of WIZARD_STEPS) {
      const tab = getStepShortcuts(step, "step", false).find((s) => s.key === "Tab");
      assert.ok(tab, `expected step '${step}' to include Tab shortcut`);
      assert.notEqual(tab.disabled, true);
    }
  });

  test("nav-focus Tab shortcut is independent of the disabled gate", () => {
    const disabledTab = getStepShortcuts("provider", "nav", true).find(
      (s) => s.key === "Tab",
    );
    const enabledTab = getStepShortcuts("provider", "nav", false).find(
      (s) => s.key === "Tab",
    );
    assert.notEqual(disabledTab?.disabled, true);
    assert.notEqual(enabledTab?.disabled, true);
  });
});
