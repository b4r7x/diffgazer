import { type OnboardingStep, WIZARD_STEPS } from "./types.js";

export const STEP_LABELS: Record<OnboardingStep, string> = {
  storage: "Storage",
  provider: "Provider",
  "api-key": "API Key",
  model: "Model",
  analysis: "Analysis",
  execution: "Execution",
};

export const STEP_TITLES: Record<OnboardingStep, string> = {
  storage: "Secrets Storage",
  provider: "AI Provider",
  "api-key": "API Key",
  model: "Model Selection",
  analysis: "Analysis Configuration",
  execution: "Agent Execution",
};

export function getStepAt(index: number): OnboardingStep {
  return WIZARD_STEPS[index] ?? "storage";
}

export function isFirstStepIndex(index: number): boolean {
  return index === 0;
}

export function isLastStepIndex(index: number): boolean {
  return index === WIZARD_STEPS.length - 1;
}

export function getOnboardingProgressLabel(index: number): string {
  const step = getStepAt(index);
  return `Step ${index + 1} of ${WIZARD_STEPS.length}: ${STEP_LABELS[step]}`;
}
