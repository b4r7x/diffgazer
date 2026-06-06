import type { OnboardingStep } from "@diffgazer/core/onboarding";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";

export function getStepShortcuts(
  currentStep: OnboardingStep,
  focusArea: "step" | "nav",
  actionDisabled: boolean,
): Shortcut[] {
  if (focusArea === "nav") {
    return [
      { key: "Tab", label: "Move to Options" },
      { key: "Enter", label: "Activate Action", disabled: actionDisabled },
    ];
  }

  switch (currentStep) {
    case "storage":
      return [
        { key: "↑/↓", label: "Navigate" },
        { key: "Enter/Space", label: "Select Storage" },
        { key: "Tab", label: "Focus Actions" },
      ];
    case "provider":
      return [
        { key: "↑/↓", label: "Navigate Providers" },
        { key: "Enter/Space", label: "Select Provider" },
        { key: "Tab", label: "Focus Actions" },
      ];
    case "api-key":
      return [
        { key: "↑/↓", label: "Navigate Fields" },
        { key: "Enter/Space", label: "Select Method" },
        { key: "Tab", label: "Focus Actions" },
      ];
    case "model":
      return [
        { key: "↑/↓", label: "Navigate Models" },
        { key: "Enter/Space", label: "Select Model" },
        { key: "Tab", label: "Focus Actions" },
      ];
    case "analysis":
      return [
        { key: "↑/↓", label: "Navigate" },
        { key: "Space", label: "Toggle Option" },
        { key: "Tab", label: "Focus Actions" },
      ];
    case "execution":
      return [
        { key: "↑/↓", label: "Navigate Modes" },
        { key: "Enter/Space", label: "Select Mode" },
        { key: "Tab", label: "Focus Actions" },
      ];
  }
}
