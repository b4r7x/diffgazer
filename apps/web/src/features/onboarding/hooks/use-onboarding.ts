import { useRef, useState } from "react";
import { getErrorMessage } from "@diffgazer/core/errors";
import { AVAILABLE_PROVIDERS, PROVIDER_ENV_VARS } from "@diffgazer/core/schemas/config";
import type { AIProvider } from "@diffgazer/core/schemas/config";
import { LENS_IDS } from "@diffgazer/core/schemas/review";
import type { InputMethod } from "@/types/input-method";
import { useConfigActions } from "@/app/providers/config-provider";
import { setConfiguredGuardCache } from "@/lib/config-guard-cache";
import { useSaveSettings, useSaveConfig, useDeleteProviderCredentials } from "@diffgazer/core/api/hooks";
import { canProceed, type OnboardingStep, type WizardData } from "@diffgazer/core/onboarding";

const STEPS: OnboardingStep[] = [
  "storage",
  "provider",
  "api-key",
  "model",
  "analysis",
  "execution",
];
const INITIAL_PROVIDER = AVAILABLE_PROVIDERS[0];

const INITIAL_DATA: WizardData = {
  secretsStorage: "file",
  provider: INITIAL_PROVIDER?.id ?? null,
  apiKey: "",
  inputMethod: "paste",
  model: INITIAL_PROVIDER?.defaultModel ?? null,
  defaultLenses: [...LENS_IDS],
  agentExecution: "sequential",
};

export function useOnboarding() {
  const { refresh: refreshConfig } = useConfigActions();
  const saveSettings = useSaveSettings();
  const saveConfig = useSaveConfig();
  const deleteCredentials = useDeleteProviderCredentials();
  const [wizardData, setWizardData] = useState<WizardData>(INITIAL_DATA);
  const [stepIndex, setStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEarlySaving, setIsEarlySaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const earlySavedProviderRef = useRef<AIProvider | null>(null);

  const currentStep = STEPS[stepIndex] ?? STEPS[0]!;
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEPS.length - 1;

  const canProceedNow = canProceed(currentStep, wizardData);

  const next = () => {
    if (!canProceedNow || isLastStep) return;
    const nextStep = STEPS[stepIndex + 1];

    // Early-save credentials before model step for OpenRouter
    if (
      nextStep === "model" &&
      wizardData.provider === "openrouter" &&
      (wizardData.apiKey || wizardData.inputMethod === "env")
    ) {
      setIsEarlySaving(true);
      const apiKey =
        wizardData.inputMethod === "env"
          ? { kind: "env" as const, varName: PROVIDER_ENV_VARS[wizardData.provider] }
          : { kind: "literal" as const, value: wizardData.apiKey };
      saveConfig
        .mutateAsync({ provider: wizardData.provider, apiKey })
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

  const cleanupEarlySave = async () => {
    const provider = earlySavedProviderRef.current;
    if (provider) {
      earlySavedProviderRef.current = null;
      await deleteCredentials.mutateAsync(provider).catch(() => {});
    }
  };

  const back = () => {
    if (isFirstStep) return;
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
      model: info?.defaultModel || null,
      apiKey: "",
      inputMethod: "paste" as InputMethod,
    }));
  };

  const complete = async () => {
    if (!wizardData.provider || !wizardData.model) return;
    setIsSubmitting(true);
    setError(null);
    try {
      earlySavedProviderRef.current = null;
      await saveSettings.mutateAsync({
        secretsStorage: wizardData.secretsStorage,
        defaultLenses: wizardData.defaultLenses,
        agentExecution: wizardData.agentExecution,
      });
      await saveConfig.mutateAsync({
        provider: wizardData.provider,
        apiKey:
          wizardData.inputMethod === "env"
            ? { kind: "env" as const, varName: PROVIDER_ENV_VARS[wizardData.provider] }
            : { kind: "literal" as const, value: wizardData.apiKey },
        model: wizardData.model ?? undefined,
      });
      await refreshConfig(true);
      setConfiguredGuardCache(true);
    } catch (e) {
      setError(getErrorMessage(e, "Setup failed"));
      throw e;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    currentStep,
    wizardData,
    steps: STEPS,
    isFirstStep,
    isLastStep,
    canProceed: canProceedNow,
    isSubmitting,
    isEarlySaving,
    error,
    next,
    back,
    updateData,
    setProvider,
    complete,
    cleanupEarlySave,
  };
}
