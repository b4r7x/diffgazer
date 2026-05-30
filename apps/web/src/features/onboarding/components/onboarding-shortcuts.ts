import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import type { OnboardingStep } from "@diffgazer/core/onboarding";

export const STEP_TITLES: Record<OnboardingStep, string> = {
  storage: "Secrets Storage",
  provider: "AI Provider",
  "api-key": "API Key",
  model: "Model Selection",
  analysis: "Analysis Configuration",
  execution: "Agent Execution",
};

export const STEP_LABELS: Record<OnboardingStep, string> = {
  storage: "Storage",
  provider: "Provider",
  "api-key": "API Key",
  model: "Model",
  analysis: "Analysis",
  execution: "Execution",
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

  switch (currentStep) {
    case "storage":
      return [
        { key: "↑/↓", label: "Navigate" },
        { key: "Space", label: "Select Storage" },
        { key: "Enter", label: "Select & Next" },
        { key: "↓", label: "Focus Actions" },
      ];
    case "provider":
      return [
        { key: "↑/↓", label: "Navigate Providers" },
        { key: "Space", label: "Select Provider" },
        { key: "Enter", label: "Select & Next" },
        { key: "↓", label: "Focus Actions" },
      ];
    case "api-key":
      return [
        { key: "↑/↓", label: "Navigate Fields" },
        { key: "Space", label: "Select Method" },
        { key: "Enter", label: "Select & Next" },
        { key: "↓", label: "Focus Actions" },
      ];
    case "model":
      return [
        { key: "↑/↓", label: "Navigate Models" },
        { key: "Space", label: "Select Model" },
        { key: "Enter", label: "Select & Next" },
        { key: "↓", label: "Focus Actions" },
      ];
    case "analysis":
      return [
        { key: "↑/↓", label: "Navigate" },
        { key: "Space", label: "Toggle Option" },
        { key: "Enter", label: "Toggle & Next" },
        { key: "↓", label: "Focus Actions" },
      ];
    case "execution":
      return [
        { key: "↑/↓", label: "Navigate Modes" },
        { key: "Space", label: "Select Mode" },
        { key: "Enter", label: "Select & Next" },
        { key: "↓", label: "Focus Actions" },
      ];
    default:
      return [];
  }
}
