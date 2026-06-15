import { useCallback, useRef, useState } from "react";
import { getErrorMessage } from "../errors.js";
import { type AIProvider, AVAILABLE_PROVIDERS } from "../schemas/config/index.js";
import { canProceed } from "./can-proceed.js";
import { getInitialWizardData } from "./defaults.js";
import { buildConfigPayload, type SaveWizardCallbacks, saveWizard } from "./save-wizard.js";
import { getStepAt, isFirstStepIndex, isLastStepIndex } from "./steps.js";
import { type OnboardingStep, WIZARD_STEPS, type WizardData } from "./types.js";

const CLEANUP_ERROR_PREFIX = "Failed to remove saved credentials";

export interface WizardSaveCallbacks extends SaveWizardCallbacks {
  deleteCredentials: (provider: AIProvider) => Promise<unknown>;
}

export interface UseWizardStateOptions {
  initial?: WizardData;
  callbacks?: WizardSaveCallbacks;
  /** Surface-specific work after a successful complete (refresh, guard cache, navigate). */
  onComplete?: () => Promise<void> | void;
  /**
   * Terminal report channel for an abandon-cleanup failure. The wizard runs
   * cleanup on unmount, so this routes to a mount-independent surface (toast)
   * rather than component-local error state.
   */
  onCleanupError?: (message: string) => void;
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
  /** True while the final save is in flight. */
  isSubmitting: boolean;
  /** Final-save error, shown in the wizard while mounted. */
  error: string | null;
  /** Early-save failure surfaced to both UIs; cleared on retry/step change. */
  earlySaveError: string | null;
  next: () => void;
  back: () => void;
  updateData: (partial: Partial<WizardData>) => void;
  setProvider: (provider: AIProvider) => void;
  /** Run the final settings + config save, then the surface's onComplete. Resolves true on success. */
  complete: () => Promise<boolean>;
  /** Clean up early-saved credentials on wizard cancel; reports failures terminally. */
  cleanupEarlySave: () => Promise<void>;
}

export function useWizardState(options: UseWizardStateOptions = {}): UseWizardStateResult {
  const { initial = getInitialWizardData(), callbacks, onComplete, onCleanupError } = options;
  const [wizardData, setWizardData] = useState<WizardData>(initial);
  const [stepIndex, setStepIndex] = useState(0);
  const [isEarlySaving, setIsEarlySaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [earlySaveError, setEarlySaveError] = useState<string | null>(null);
  const earlySavedProviderRef = useRef<AIProvider | null>(null);

  const currentStep = getStepAt(stepIndex);
  const isFirst = isFirstStepIndex(stepIndex);
  const isLast = isLastStepIndex(stepIndex);
  const canProceedNow = canProceed(currentStep, wizardData);

  const goToStep = (index: number) => {
    setEarlySaveError(null);
    setStepIndex(index);
  };

  const next = () => {
    if (!canProceedNow || isLast) return;
    const nextStep = getStepAt(stepIndex + 1);

    // Early-save credentials before the model step for providers that need an
    // API key to fetch models (e.g. OpenRouter). Persist the storage choice
    // first so a fresh install (secretsStorage === null) does not reject the
    // credential save with STORAGE_NOT_CONFIGURED.
    if (
      nextStep === "model" &&
      wizardData.provider === "openrouter" &&
      callbacks &&
      (wizardData.apiKey || wizardData.inputMethod === "env")
    ) {
      setIsEarlySaving(true);
      setEarlySaveError(null);
      runEarlySave(wizardData, callbacks)
        .then(() => {
          earlySavedProviderRef.current = wizardData.provider;
          setStepIndex((prev) => prev + 1);
        })
        .catch((cause) => {
          setEarlySaveError(getErrorMessage(cause, "Failed to save credentials"));
        })
        .finally(() => setIsEarlySaving(false));
      return;
    }

    goToStep(stepIndex + 1);
  };

  const back = () => {
    if (isFirst) return;
    goToStep(stepIndex - 1);
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

  const complete = async () => {
    if (!callbacks) return false;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await saveWizard(wizardData, callbacks);
      if (result.status === "partial") {
        setError(getErrorMessage(result.error, "Setup failed"));
        return false;
      }
      earlySavedProviderRef.current = null;
      await onComplete?.();
      return true;
    } finally {
      setIsSubmitting(false);
    }
  };

  const cleanupEarlySave = useCallback(async () => {
    const provider = earlySavedProviderRef.current;
    if (!provider || !callbacks) return;
    try {
      await callbacks.deleteCredentials(provider);
      earlySavedProviderRef.current = null;
    } catch (cause) {
      // Runs on wizard unmount: report terminally through the surface's channel,
      // never rethrow into the voided caller or set unmounting-component state.
      onCleanupError?.(
        `${CLEANUP_ERROR_PREFIX}: ${getErrorMessage(cause, "Retry to remove them.")}`,
      );
    }
  }, [callbacks, onCleanupError]);

  return {
    wizardData,
    stepIndex,
    currentStep,
    steps: WIZARD_STEPS,
    isFirstStep: isFirst,
    isLastStep: isLast,
    canProceed: canProceedNow,
    isEarlySaving,
    isSubmitting,
    error,
    earlySaveError,
    next,
    back,
    updateData,
    setProvider,
    complete,
    cleanupEarlySave,
  };
}

async function runEarlySave(data: WizardData, callbacks: WizardSaveCallbacks): Promise<void> {
  // Persist the storage choice first so the credential save is not rejected
  // with STORAGE_NOT_CONFIGURED on a fresh install (secretsStorage starts null).
  await callbacks.saveSettings({ secretsStorage: data.secretsStorage });
  await callbacks.saveConfig(buildConfigPayload(data));
}
