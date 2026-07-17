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
  /** Terminal report channel for an abandon-cleanup failure; runs on unmount, so it routes to a mount-independent surface, not component state. */
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
  /** True while an early credential save or reconciliation is in flight. */
  isEarlySaving: boolean;
  /** True while the final save is in flight. */
  isSubmitting: boolean;
  /** Final-save error, shown in the wizard while mounted. */
  error: string | null;
  /** Early-save failure surfaced to both UIs; cleared on retry/step change. */
  earlySaveError: string | null;
  /** Commit optional step data and advance after validating the resulting state. */
  next: (partial?: Partial<WizardData>) => void;
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
  const pendingSaveRef = useRef<Promise<void> | null>(null);

  const currentStep = getStepAt(stepIndex);
  const isFirst = isFirstStepIndex(stepIndex);
  const isLast = isLastStepIndex(stepIndex);
  const canProceedNow = canProceed(currentStep, wizardData);

  const applyProvider = (provider: AIProvider) => {
    const info = AVAILABLE_PROVIDERS.find((candidate) => candidate.id === provider);
    setWizardData((prev) => ({
      ...prev,
      provider,
      model: info?.defaultModel || null,
      apiKey: "",
      inputMethod: "paste",
    }));
  };

  const reconcileEarlySavedProvider = async (provider: AIProvider | null) => {
    const savedProvider = earlySavedProviderRef.current;
    if (!savedProvider || savedProvider === provider || !callbacks) return;

    await callbacks.deleteCredentials(savedProvider);
    if (earlySavedProviderRef.current === savedProvider) {
      earlySavedProviderRef.current = null;
    }
  };

  const goToStep = (index: number) => {
    setEarlySaveError(null);
    setStepIndex(index);
  };

  const next = (partial?: Partial<WizardData>) => {
    const projectedData = partial ? { ...wizardData, ...partial } : wizardData;
    if (!canProceed(currentStep, projectedData) || isLast) return;
    const nextStep = getStepAt(stepIndex + 1);
    if (partial) setWizardData((currentData) => ({ ...currentData, ...partial }));

    // Early-save credentials before the model step for providers that need an
    // API key to fetch models (e.g. OpenRouter).
    if (
      nextStep === "model" &&
      projectedData.provider === "openrouter" &&
      callbacks &&
      (projectedData.apiKey || projectedData.inputMethod === "env")
    ) {
      setIsEarlySaving(true);
      setEarlySaveError(null);
      // Track the in-flight commit so a racing abandon-cleanup can await it and not leak credentials.
      const savePromise = runEarlySave(projectedData, callbacks).then(() => {
        earlySavedProviderRef.current = projectedData.provider;
      });
      pendingSaveRef.current = savePromise;
      savePromise
        .then(() => setStepIndex((prev) => prev + 1))
        .catch((cause) => {
          setEarlySaveError(getErrorMessage(cause, "Failed to save credentials"));
        })
        .finally(() => {
          pendingSaveRef.current = null;
          setIsEarlySaving(false);
        });
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
    if (
      earlySavedProviderRef.current === null ||
      earlySavedProviderRef.current === provider ||
      !callbacks
    ) {
      applyProvider(provider);
      return;
    }

    setIsEarlySaving(true);
    setEarlySaveError(null);
    const reconciliation = reconcileEarlySavedProvider(provider).then(() =>
      applyProvider(provider),
    );
    pendingSaveRef.current = reconciliation;
    reconciliation
      .catch((cause) => {
        setEarlySaveError(
          `${CLEANUP_ERROR_PREFIX}: ${getErrorMessage(cause, "Retry to remove them.")}`,
        );
      })
      .finally(() => {
        if (pendingSaveRef.current === reconciliation) pendingSaveRef.current = null;
        setIsEarlySaving(false);
      });
  };

  const complete = async () => {
    if (!callbacks) return false;
    setIsSubmitting(true);
    setError(null);
    try {
      const pending = pendingSaveRef.current;
      if (pending) await pending;
      await reconcileEarlySavedProvider(wizardData.provider);
      const result = await saveWizard(wizardData, callbacks);
      if (result.status === "partial") {
        setError(getErrorMessage(result.error, "Setup failed"));
        return false;
      }
      earlySavedProviderRef.current = null;
      await onComplete?.();
      return true;
    } catch (cause) {
      setError(getErrorMessage(cause, "Setup failed"));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const cleanupEarlySave = useCallback(async () => {
    // Wait for any in-flight early save to settle before deleting, so we observe
    // whether the credentials landed rather than racing the write.
    const pending = pendingSaveRef.current;
    if (pending) await pending.catch(() => {});

    const provider = earlySavedProviderRef.current;
    if (!provider || !callbacks) return;
    try {
      await callbacks.deleteCredentials(provider);
      earlySavedProviderRef.current = null;
    } catch (cause) {
      // Runs on unmount: report terminally; never rethrow or set unmounting-component state.
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
  // Persist storage first, or a fresh install (secretsStorage null) rejects the credential save with STORAGE_NOT_CONFIGURED.
  await callbacks.saveSettings({ secretsStorage: data.secretsStorage });
  await callbacks.saveConfig(buildConfigPayload(data));
}
