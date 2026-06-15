import type { OnboardingStep } from "@diffgazer/core/onboarding";

type FocusArea = "step" | "nav";

/**
 * The api-key step owns Tab while the step body is focused: Tab toggles the
 * key input rather than the wizard's step/nav focus area, so a single
 * subscriber arbitrates the keystroke (F-347a — Ink delivers to all active
 * useInput subscribers).
 */
export function apiKeyStepOwnsTab(step: OnboardingStep, focusArea: FocusArea): boolean {
  return step === "api-key" && focusArea === "step";
}
