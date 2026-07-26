import type { OnboardingStep } from "@diffgazer/core/onboarding";
import { NAVIGATE_SHORTCUT, type Shortcut } from "@diffgazer/core/schemas/presentation";

interface StepActionLabels {
  navigate: string;
  select: string;
  enter: string;
}

// A Record keyed by OnboardingStep rather than a switch: a seventh step is a
// compile error here instead of a silently empty footer.
const STEP_ACTION_LABELS: Record<OnboardingStep, StepActionLabels> = {
  storage: {
    navigate: NAVIGATE_SHORTCUT.label,
    select: "Select Storage",
    enter: "Select & Next",
  },
  provider: { navigate: "Navigate Providers", select: "Select Provider", enter: "Select & Next" },
  "api-key": { navigate: "Navigate Fields", select: "Select Method", enter: "Select & Next" },
  model: { navigate: "Navigate Models", select: "Select Model", enter: "Select & Next" },
  analysis: {
    navigate: NAVIGATE_SHORTCUT.label,
    select: "Toggle Option",
    enter: "Toggle & Next",
  },
  execution: { navigate: "Navigate Modes", select: "Select Mode", enter: "Select & Next" },
};

export function getStepShortcuts(
  currentStep: OnboardingStep,
  isButtonsZone: boolean,
  actionDisabled = false,
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
    { key: NAVIGATE_SHORTCUT.key, label: labels.navigate },
    { key: "Space", label: labels.select },
    { key: "Enter", label: labels.enter },
    { key: "↓", label: "Focus Actions" },
  ];
}
