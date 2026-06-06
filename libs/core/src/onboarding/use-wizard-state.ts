import { useCallback, useRef, useState } from "react";
import { type AIProvider, AVAILABLE_PROVIDERS } from "../schemas/config/index.js";
import { canProceed } from "./can-proceed.js";
import { getInitialWizardData } from "./defaults.js";
import {
  getStepAt,
  isFirstStepIndex,
  isLastStepIndex,
} from "./steps.js";
import { type OnboardingStep, WIZARD_STEPS, type WizardData } from "./types.js";

export interface EarlySaveCallbacks {
  saveCredentials: (provider: AIProvider, apiKey: string) => Promise<void>;
  deleteCredentials: (provider: AIProvider) => Promise<void>;
}

export interface UseWizardStateResult {
  wizardData: WizardData;
  stepIndex: number;
  currentStep: OnboardingStep;
  steps: readonly OnboardingStep[];
  isFirstStep: boolean;
  isLastStep: boolean;
  canProceed: boolean;
  /** True while an early-save is in flight. */
  isEarlySaving: boolean;
  next: () => void;
  back: () => void;
  updateData: (partial: Partial<WizardData>) => void;
  setProvider: (provider: AIProvider) => void;
  /** Clean up early-saved credentials on wizard cancel. */
  cleanupEarlySave: () => Promise<void>;
  /** Mark early-save as consumed (e.g. after final save overwrites it). */
  acknowledgeEarlySave: () => void;
}

export function useWizardState(
  initial: WizardData = getInitialWizardData(),
  earlySave?: EarlySaveCallbacks,
): UseWizardStateResult {
  const [wizardData, setWizardData] = useState<WizardData>(initial);
  const [stepIndex, setStepIndex] = useState(0);
  const [isEarlySaving, setIsEarlySaving] = useState(false);
  const earlySavedProviderRef = useRef<AIProvider | null>(null);

  const currentStep = getStepAt(stepIndex);
  const isFirst = isFirstStepIndex(stepIndex);
  const isLast = isLastStepIndex(stepIndex);
  const canProceedNow = canProceed(currentStep, wizardData);

  const next = () => {
    if (!canProceedNow || isLast) return;
    const nextStep = getStepAt(stepIndex + 1);

    // Early-save credentials before model step for providers that need API key
    // to fetch models (e.g. OpenRouter)
    if (
      nextStep === "model" &&
      wizardData.provider === "openrouter" &&
      earlySave &&
      (wizardData.apiKey || wizardData.inputMethod === "env")
    ) {
      setIsEarlySaving(true);
      const apiKey =
        wizardData.inputMethod === "env" ? "env" : wizardData.apiKey;
      earlySave
        .saveCredentials(wizardData.provider, apiKey)
        .then(() => {
          earlySavedProviderRef.current = wizardData.provider;
          setStepIndex((prev) => prev + 1);
        })
        .catch(() => {
          // Save failed; stay on current step
        })
        .finally(() => setIsEarlySaving(false));
      return;
    }

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

  const cleanupEarlySave = useCallback(async () => {
    const provider = earlySavedProviderRef.current;
    if (provider && earlySave) {
      earlySavedProviderRef.current = null;
      await earlySave.deleteCredentials(provider).catch(() => {});
    }
  }, [earlySave]);

  const acknowledgeEarlySave = useCallback(() => {
    earlySavedProviderRef.current = null;
  }, []);

  return {
    wizardData,
    stepIndex,
    currentStep,
    steps: WIZARD_STEPS,
    isFirstStep: isFirst,
    isLastStep: isLast,
    canProceed: canProceedNow,
    isEarlySaving,
    next,
    back,
    updateData,
    setProvider,
    cleanupEarlySave,
    acknowledgeEarlySave,
  };
}
