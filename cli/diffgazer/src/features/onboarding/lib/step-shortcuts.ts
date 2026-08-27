import type { InputMethod, OnboardingStep } from "@diffgazer/core/onboarding";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";

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
    case "product":
      return [
        { key: "↑/↓", label: "Navigate Products" },
        { key: "Enter/Space", label: "Select Product" },
        { key: "Tab", label: "Focus Actions" },
      ];
    case "endpoint-binding":
      return [
        { key: "↑/↓", label: "Navigate Endpoints" },
        { key: "Enter/Space", label: "Select Endpoint" },
        { key: "Tab", label: "Focus Actions" },
      ];
    case "authentication":
      if (apiKeyInputFocused) {
        return [
          { key: "↑/↓", label: "Leave Field" },
          { key: "Tab", label: "Focus Actions" },
        ];
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
    case "acknowledgement":
      return [
        { key: "Enter/Space", label: "Accept Consent" },
        { key: "Tab", label: "Focus Actions" },
      ];
  }
}
