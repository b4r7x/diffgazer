import {
  useDeleteProviderCredentials,
  useSaveConfig,
  useSaveSettings,
} from "@diffgazer/core/api/hooks";
import {
  INPUT_METHODS,
  type InputMethod,
  type OnboardingStep,
  useWizardState,
} from "@diffgazer/core/onboarding";
import type { AIProvider } from "@diffgazer/core/schemas/config";
import { AI_PROVIDERS, isAgentExecution, isSecretsStorage } from "@diffgazer/core/schemas/config";
import type { LensId } from "@diffgazer/core/schemas/review";
import { useEffect, useEffectEvent, useState } from "react";
import { useRegisterExitPreparation } from "../../../hooks/use-exit";
import { useNavigation } from "../../../hooks/use-navigation";

type FocusArea = "step" | "nav";
type WizardFocusZone = "step" | "nav" | "api-key-method" | "api-key-input";

function getStepFocusZone(step: OnboardingStep): WizardFocusZone {
  return step === "api-key" ? "api-key-method" : "step";
}

function isAIProvider(v: string): v is AIProvider {
  return (AI_PROVIDERS as readonly string[]).includes(v);
}

function isInputMethod(v: string): v is InputMethod {
  return (INPUT_METHODS as readonly string[]).includes(v);
}

function reportCleanupError(message: string): void {
  console.error(`Warning: ${message}`);
}

export function useOnboardingWizard() {
  const { navigate } = useNavigation();
  const saveSettings = useSaveSettings();
  const saveConfig = useSaveConfig();
  const deleteCredentials = useDeleteProviderCredentials();
  const [focusZone, setFocusZone] = useState<WizardFocusZone>("step");
  const [navIndex, setNavIndex] = useState(0);

  const wizard = useWizardState({
    callbacks: {
      saveSettings: (payload) => saveSettings.mutateAsync(payload),
      saveConfig: (payload) => saveConfig.mutateAsync(payload),
      deleteCredentials: (provider) => deleteCredentials.mutateAsync(provider),
    },
    onComplete: () => navigate({ screen: "home" }),
    onCleanupError: reportCleanupError,
  });

  useRegisterExitPreparation(wizard.cleanupEarlySave);

  const cleanupEarlySaveOnUnmount = useEffectEvent(() => {
    void wizard.cleanupEarlySave();
  });

  useEffect(
    () => () => {
      cleanupEarlySaveOnUnmount();
    },
    [],
  );

  const isSaving = saveSettings.isPending || saveConfig.isPending || wizard.isEarlySaving;
  const focusArea: FocusArea = focusZone === "nav" ? "nav" : "step";
  const apiKeyInputFocused = focusZone === "api-key-input";

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
    const nextStep = wizard.steps[wizard.stepIndex + 1];
    wizard.next();
    setFocusZone(nextStep ? getStepFocusZone(nextStep) : "step");
    setNavIndex(0);
  }

  function handleBack() {
    if (wizard.isFirstStep) return;
    const previousStep = wizard.steps[wizard.stepIndex - 1];
    wizard.back();
    setFocusZone(previousStep ? getStepFocusZone(previousStep) : "step");
    setNavIndex(0);
  }

  function toggleFocusArea() {
    setFocusZone((current) => (current === "nav" ? getStepFocusZone(wizard.currentStep) : "nav"));
    setNavIndex(0);
  }

  function cycleFocusZone() {
    if (wizard.currentStep !== "api-key") {
      toggleFocusArea();
      return;
    }

    if (focusZone === "api-key-input") {
      setFocusZone("nav");
      setNavIndex(wizard.isFirstStep ? 0 : 1);
      return;
    }
    if (focusZone === "nav") {
      setFocusZone("api-key-method");
      setNavIndex(0);
      return;
    }
    if (wizard.wizardData.inputMethod === "paste") {
      setFocusZone("api-key-input");
      return;
    }
    setFocusZone("nav");
    setNavIndex(wizard.isFirstStep ? 0 : 1);
  }

  function setApiKeyInputFocused(focused: boolean) {
    setFocusZone(focused ? "api-key-input" : "api-key-method");
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
    focusZone,
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
    cycleFocusZone,
    setApiKeyInputFocused,
    moveNavIndex,
  };
}
