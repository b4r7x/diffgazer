import type { RunnableSetupPlan } from "./setup-plan.js";
import type { OnboardingStep } from "./types.js";

export const STEP_LABELS = {
  product: "Product",
  "endpoint-binding": "Endpoint",
  authentication: "Authentication",
  model: "Model",
  acknowledgement: "Consent",
} as const satisfies Record<OnboardingStep, string>;

export const STEP_TITLES = {
  product: "Select Product",
  "endpoint-binding": "Configure Endpoint",
  authentication: "Configure Authentication",
  model: "Select Model",
  acknowledgement: "Provider Consent",
} as const satisfies Record<OnboardingStep, string>;

export function getStepAt(plan: RunnableSetupPlan, index: number): OnboardingStep {
  const step = plan.steps[index];
  if (!step) throw new RangeError(`No onboarding step at index ${index}`);
  return step.id;
}

export function getOnboardingProgressLabel(plan: RunnableSetupPlan, index: number): string {
  const step = getStepAt(plan, index);
  return `Step ${index + 1} of ${plan.steps.length}: ${STEP_LABELS[step]}`;
}
