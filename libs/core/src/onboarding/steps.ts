import type { SetupPlan } from "./setup-plan.js";
import type { OnboardingStep } from "./types.js";

export const STEP_LABELS = {
  product: "Product",
  "endpoint-binding": "Endpoint",
  authentication: "Authentication",
  model: "Model",
  conformance: "Conformance",
  acknowledgement: "Notice",
  migration: "Migration",
  delete: "Delete",
} as const satisfies Record<OnboardingStep, string>;

export const STEP_TITLES = {
  product: "Select Product",
  "endpoint-binding": "Configure Endpoint",
  authentication: "Configure Authentication",
  model: "Select Model",
  conformance: "Verify Conformance",
  acknowledgement: "Accept Product Notice",
  migration: "Create a General Z.AI Configuration",
  delete: "Delete Removed Configuration",
} as const satisfies Record<OnboardingStep, string>;

export function getStepAt(plan: SetupPlan, index: number): OnboardingStep {
  const step = plan.steps[index];
  if (!step) throw new RangeError(`No onboarding step at index ${index}`);
  return step.id;
}

export function getOnboardingProgressLabel(plan: SetupPlan, index: number): string {
  const step = getStepAt(plan, index);
  return `Step ${index + 1} of ${plan.steps.length}: ${STEP_LABELS[step]}`;
}
