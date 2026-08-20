import type { OnboardingStep } from "@diffgazer/core/onboarding";
import { NAVIGATE_SHORTCUT, type Shortcut } from "@diffgazer/core/schemas/presentation";

interface StepActionLabels {
  navigate?: string;
  select: string;
  enter: string;
}

const STEP_ACTION_LABELS: Record<OnboardingStep, StepActionLabels> = {
  product: { navigate: "Navigate Products", select: "Select Product", enter: "Select & Next" },
  "endpoint-binding": {
    navigate: NAVIGATE_SHORTCUT.label,
    select: "Select Option",
    enter: "Select & Next",
  },
  authentication: {
    navigate: "Navigate Fields",
    select: "Select Method",
    enter: "Select & Next",
  },
  model: { navigate: "Navigate Models", select: "Select Model", enter: "Select & Next" },
  // The consent step has a single checkbox, so there is nothing to navigate.
  acknowledgement: {
    select: "Accept Consent",
    enter: "Continue",
  },
};

export function getStepShortcuts(
  currentStep: OnboardingStep,
  isButtonsZone: boolean,
  actionDisabled = false,
  canProceed = true,
): Shortcut[] {
  if (isButtonsZone) {
    return [
      { key: "←/→", label: "Move Action" },
      { key: "Enter/Space", label: "Activate Action", disabled: actionDisabled },
      { key: "↑", label: "Back to Options" },
    ];
  }

  const labels = STEP_ACTION_LABELS[currentStep];
  return [
    ...(labels.navigate ? [{ key: NAVIGATE_SHORTCUT.key, label: labels.navigate }] : []),
    { key: "Space", label: labels.select },
    // Enter no-ops on the consent step until the box is checked; the radio
    // steps commit the highlighted item instead, so their Enter hint is live.
    {
      key: "Enter",
      label: labels.enter,
      disabled: currentStep === "acknowledgement" && !canProceed,
    },
    { key: "↓", label: "Focus Actions" },
  ];
}
