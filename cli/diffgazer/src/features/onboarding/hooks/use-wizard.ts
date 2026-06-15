import {
  useDeleteProviderCredentials,
  useSaveConfig,
  useSaveSettings,
} from "@diffgazer/core/api/hooks";
import { INPUT_METHODS, type InputMethod, useWizardState } from "@diffgazer/core/onboarding";
import type { AIProvider } from "@diffgazer/core/schemas/config";
import { AI_PROVIDERS, isAgentExecution, isSecretsStorage } from "@diffgazer/core/schemas/config";
import type { LensId } from "@diffgazer/core/schemas/review";
import { useState } from "react";
import { useNavigation } from "../../../hooks/use-navigation";

type FocusArea = "step" | "nav";

function isAIProvider(v: string): v is AIProvider {
  return (AI_PROVIDERS as readonly string[]).includes(v);
}

function isInputMethod(v: string): v is InputMethod {
  return (INPUT_METHODS as readonly string[]).includes(v);
}

export function useOnboardingWizard() {
  const { navigate } = useNavigation();
  const saveSettings = useSaveSettings();
  const saveConfig = useSaveConfig();
  const deleteCredentials = useDeleteProviderCredentials();
  const [focusArea, setFocusArea] = useState<FocusArea>("step");
  const [navIndex, setNavIndex] = useState(0);
  const [apiKeyInputFocused, setApiKeyInputFocused] = useState(false);

  const wizard = useWizardState({
    callbacks: {
      saveSettings: (payload) => saveSettings.mutateAsync(payload),
      saveConfig: (payload) => saveConfig.mutateAsync(payload),
      deleteCredentials: (provider) => deleteCredentials.mutateAsync(provider),
    },
    onComplete: () => navigate({ screen: "home" }),
  });

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

  function handleNext() {
    if (!wizard.canProceed) return;
    if (wizard.isLastStep) {
      void wizard.complete();
      return;
    }
    wizard.next();
    setFocusArea("step");
    setNavIndex(0);
    setApiKeyInputFocused(false);
  }

  function handleBack() {
    if (wizard.isFirstStep) return;
    wizard.back();
    setFocusArea("step");
    setNavIndex(0);
    setApiKeyInputFocused(false);
  }

  function toggleFocusArea() {
    setFocusArea((prev) => (prev === "step" ? "nav" : "step"));
    setNavIndex(0);
  }

  function toggleApiKeyInputFocus() {
    setApiKeyInputFocused((focused) => !focused);
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
    apiKeyInputFocused,
    isSaving,
    error: wizard.error ?? wizard.earlySaveError,

    handleProviderChange,
    handleSecretsStorageChange,
    handleAgentExecutionChange,
    handleInputMethodChange,
    handleApiKeyChange,
    handleModelChange,
    handleLensesChange,
    cleanupEarlySave: wizard.cleanupEarlySave,
    handleNext,
    handleBack,
    toggleFocusArea,
    toggleApiKeyInputFocus,
    setApiKeyInputFocused,
    moveNavIndex,
  };
}
