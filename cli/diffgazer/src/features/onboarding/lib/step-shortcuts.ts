import type { InputMethod, OnboardingStep } from "@diffgazer/core/onboarding";
import { NAVIGATE_SHORTCUT, type Shortcut } from "@diffgazer/core/schemas/presentation";

interface StepShortcutState {
  currentStep: OnboardingStep;
  focusArea: "step" | "nav";
  navIndex: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  canProceed: boolean;
  inputMethod: InputMethod;
  apiKeyInputFocused: boolean;
}

export function getStepShortcuts({
  currentStep,
  focusArea,
  navIndex,
  isFirstStep,
  isLastStep,
  canProceed,
  inputMethod,
  apiKeyInputFocused,
}: StepShortcutState): Shortcut[] {
  if (focusArea === "nav") {
    const isBackFocused = !isFirstStep && navIndex === 0;
    let actionLabel = "Next";
    if (isBackFocused) actionLabel = "Back";
    else if (isLastStep) actionLabel = "Complete Setup";
    return [
      { key: "Tab", label: "Move to Options" },
      {
        key: "Enter",
        label: actionLabel,
        disabled: !isBackFocused && !canProceed,
      },
    ];
  }

  switch (currentStep) {
    case "storage":
      return [
        NAVIGATE_SHORTCUT,
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
      if (apiKeyInputFocused) {
        return [{ key: "Tab", label: "Focus Actions" }];
      }
      return [
        { key: "↑/↓", label: "Navigate Methods" },
        { key: "Enter/Space", label: "Select Method" },
        { key: "Tab", label: inputMethod === "paste" ? "Focus Input" : "Focus Actions" },
      ];
    case "model":
      return [
        { key: "↑/↓", label: "Navigate Models" },
        { key: "Enter/Space", label: "Select Model" },
        { key: "Tab", label: "Focus Actions" },
      ];
    case "analysis":
      return [
        NAVIGATE_SHORTCUT,
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
