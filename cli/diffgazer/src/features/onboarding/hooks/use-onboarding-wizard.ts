import { useState } from "react";
import { getErrorMessage } from "@diffgazer/core/errors";
import type { LensId } from "@diffgazer/core/schemas/review";
import type {
  AIProvider,
  SecretsStorage,
  AgentExecution,
} from "@diffgazer/core/schemas/config";
import {
  AI_PROVIDERS,
  SECRETS_STORAGE,
  AGENT_EXECUTION_MODES,
} from "@diffgazer/core/schemas/config";
import {
  INPUT_METHODS,
  saveWizard,
  useWizardState,
  type InputMethod,
} from "@diffgazer/core/onboarding";
import { useSaveSettings, useSaveConfig, useDeleteProviderCredentials } from "@diffgazer/core/api/hooks";
import { useNavigation } from "../../../app/navigation-context.js";

type FocusArea = "step" | "nav";

function isSecretsStorage(v: string): v is SecretsStorage {
  return (SECRETS_STORAGE as readonly string[]).includes(v);
}

function isAIProvider(v: string): v is AIProvider {
  return (AI_PROVIDERS as readonly string[]).includes(v);
}

function isAgentExecution(v: string): v is AgentExecution {
  return (AGENT_EXECUTION_MODES as readonly string[]).includes(v);
}

function isInputMethod(v: string): v is InputMethod {
  return (INPUT_METHODS as readonly string[]).includes(v);
}

export function useOnboardingWizard() {
  const { navigate } = useNavigation();
  const saveSettings = useSaveSettings();
  const saveConfig = useSaveConfig();
  const deleteCredentials = useDeleteProviderCredentials();

  const wizard = useWizardState(undefined, {
    saveCredentials: async (provider, apiKey) => {
      await saveConfig.mutateAsync({ provider, apiKey });
    },
    deleteCredentials: async (provider) => {
      await deleteCredentials.mutateAsync(provider);
    },
  });
  const [focusArea, setFocusArea] = useState<FocusArea>("step");
  const [navIndex, setNavIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isSaving = saveSettings.isPending || saveConfig.isPending || wizard.isEarlySaving;

  function handleProviderChange(v: string) {
    if (isAIProvider(v)) wizard.setProvider(v);
  }

  function handleSecretsStorageChange(v: string) {
    if (isSecretsStorage(v)) wizard.updateData({ secretsStorage: v });
  }

  function handleAgentExecutionChange(v: string) {
    if (isAgentExecution(v)) wizard.updateData({ agentExecution: v });
  }

  function handleInputMethodChange(v: string) {
    if (isInputMethod(v)) wizard.updateData({ inputMethod: v });
  }

  function handleApiKeyChange(v: string) {
    wizard.updateData({ apiKey: v });
  }

  function handleModelChange(v: string) {
    wizard.updateData({ model: v });
  }

  function handleLensesChange(v: LensId[]) {
    wizard.updateData({ defaultLenses: v });
  }

  async function handleComplete() {
    setError(null);
    const result = await saveWizard(wizard.wizardData, {
      saveSettings: (payload) => saveSettings.mutateAsync(payload),
      saveConfig: (payload) => saveConfig.mutateAsync(payload),
    });
    if (result.status === "partial") {
      setError(getErrorMessage(result.error, "Setup failed"));
      return;
    }
    navigate({ screen: "home" });
  }

  function handleNext() {
    if (!wizard.canProceed) return;
    if (wizard.isLastStep) {
      void handleComplete();
      return;
    }
    wizard.next();
    setFocusArea("step");
    setNavIndex(0);
  }

  function handleBack() {
    if (wizard.isFirstStep) return;
    wizard.back();
    setFocusArea("step");
    setNavIndex(0);
  }

  function toggleFocusArea() {
    setFocusArea((prev) => (prev === "step" ? "nav" : "step"));
    setNavIndex(0);
  }

  function moveNavIndex(direction: 1 | -1) {
    const buttonCount = wizard.isFirstStep ? 1 : 2;
    setNavIndex((i) => Math.max(0, Math.min(buttonCount - 1, i + direction)));
  }

  return {
    wizardData: wizard.wizardData,
    currentStep: wizard.currentStep,
    stepIndex: wizard.stepIndex,
    steps: wizard.steps,
    isFirstStep: wizard.isFirstStep,
    isLastStep: wizard.isLastStep,
    canProceed: wizard.canProceed,
    focusArea,
    navIndex,
    isSaving,
    error,

    handleProviderChange,
    handleSecretsStorageChange,
    handleAgentExecutionChange,
    handleInputMethodChange,
    handleApiKeyChange,
    handleModelChange,
    handleLensesChange,
    handleNext,
    handleBack,
    toggleFocusArea,
    moveNavIndex,
  };
}
