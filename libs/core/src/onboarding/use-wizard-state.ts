import { useState } from "react";
import { AVAILABLE_PROVIDERS, type AIProvider } from "@diffgazer/core/schemas/config";
import { canProceed } from "./can-proceed.js";
import { getInitialWizardData } from "./defaults.js";
import {
  WIZARD_STEPS,
  getStepAt,
  isFirstStepIndex,
  isLastStepIndex,
} from "./steps.js";
import type { OnboardingStep, WizardData } from "./types.js";

export interface UseWizardStateResult {
  wizardData: WizardData;
  stepIndex: number;
  currentStep: OnboardingStep;
  steps: readonly OnboardingStep[];
  isFirstStep: boolean;
  isLastStep: boolean;
  canProceed: boolean;
  next: () => void;
  back: () => void;
  updateData: (partial: Partial<WizardData>) => void;
  setProvider: (provider: AIProvider) => void;
}

export function useWizardState(
  initial: WizardData = getInitialWizardData(),
): UseWizardStateResult {
  const [wizardData, setWizardData] = useState<WizardData>(initial);
  const [stepIndex, setStepIndex] = useState(0);

  const currentStep = getStepAt(stepIndex);
  const isFirst = isFirstStepIndex(stepIndex);
  const isLast = isLastStepIndex(stepIndex);
  const canProceedNow = canProceed(currentStep, wizardData);

  const next = () => {
    if (!canProceedNow || isLast) return;
    setStepIndex((prev) => prev + 1);
  };

  const back = () => {
    if (isFirst) return;
    setStepIndex((prev) => prev - 1);
  };

  const updateData = (partial: Partial<WizardData>) => {
    setWizardData((prev) => ({ ...prev, ...partial }));
  };

  const setProvider = (provider: AIProvider) => {
    const info = AVAILABLE_PROVIDERS.find((p) => p.id === provider);
    setWizardData((prev) => ({
      ...prev,
      provider,
      // Treat an empty `defaultModel` as "no default" (e.g. OpenRouter): the
      // user must explicitly pick a model on the next step. Using `||` keeps
      // parity with the pre-extraction web hook and avoids leaking "" into
      // downstream validation that expects a non-empty model ID.
      model: info?.defaultModel || null,
      apiKey: "",
      inputMethod: "paste",
    }));
  };

  return {
    wizardData,
    stepIndex,
    currentStep,
    steps: WIZARD_STEPS,
    isFirstStep: isFirst,
    isLastStep: isLast,
    canProceed: canProceedNow,
    next,
    back,
    updateData,
    setProvider,
  };
}
