import { useReducer, useRef } from "react";
import { getErrorMessage } from "@diffgazer/core/errors";
import { AVAILABLE_PROVIDERS, PROVIDER_ENV_VARS } from "@diffgazer/core/schemas/config";
import type { AIProvider } from "@diffgazer/core/schemas/config";
import { LENS_IDS } from "@diffgazer/core/schemas/review";
import { useConfigActions } from "@/app/providers/config-provider";
import { setConfiguredGuardCache } from "@/lib/config-guard-cache";
import { useSaveSettings, useSaveConfig, useDeleteProviderCredentials } from "@diffgazer/core/api/hooks";
import { canProceed, type OnboardingStep, type WizardData } from "@diffgazer/core/onboarding";
import { createInitialState, onboardingReducer } from "./onboarding-reducer";

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
  secretsStorage: null,
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
  const [state, dispatch] = useReducer(onboardingReducer, INITIAL_DATA, createInitialState);
  const { wizardData, stepIndex, isSubmitting, isEarlySaving, error } = state;
  const earlySavedProviderRef = useRef<AIProvider | null>(null);

  const currentStep = STEPS[stepIndex] ?? STEPS[0]!;
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEPS.length - 1;

  const canProceedNow = canProceed(currentStep, wizardData);

  const next = () => {
    if (!canProceedNow || isLastStep || isEarlySaving) return;
    const nextStep = STEPS[stepIndex + 1];

    // Early-save credentials before model step for OpenRouter
    if (
      nextStep === "model" &&
      wizardData.provider === "openrouter" &&
      (wizardData.apiKey || wizardData.inputMethod === "env")
    ) {
      dispatch({ type: "startEarlySave" });
      const apiKey =
        wizardData.inputMethod === "env"
          ? { kind: "env" as const, varName: PROVIDER_ENV_VARS[wizardData.provider] }
          : { kind: "literal" as const, value: wizardData.apiKey };
      saveConfig
        .mutateAsync({ provider: wizardData.provider, apiKey })
        .then(() => {
          earlySavedProviderRef.current = wizardData.provider;
          dispatch({ type: "advanceStep" });
        })
        .catch((e) => {
          dispatch({ type: "setError", error: getErrorMessage(e, "Failed to save credentials") });
        })
        .finally(() => dispatch({ type: "endEarlySave" }));
      return;
    }

    dispatch({ type: "advanceStep" });
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
    dispatch({ type: "back" });
  };

  const updateData = (partial: Partial<WizardData>) => {
    dispatch({ type: "updateData", partial });
  };

  const setProvider = (provider: AIProvider) => {
    const info = AVAILABLE_PROVIDERS.find((p) => p.id === provider);
    dispatch({ type: "setProvider", provider, model: info?.defaultModel || null });
  };

  const complete = async () => {
    if (!wizardData.provider || !wizardData.model) return;
    dispatch({ type: "startSubmit" });
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
      dispatch({ type: "setError", error: getErrorMessage(e, "Setup failed") });
      throw e;
    } finally {
      dispatch({ type: "endSubmit" });
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
