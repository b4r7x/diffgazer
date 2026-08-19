import { useConfigurationAction, useSaveSettings, useSettings } from "@diffgazer/core/api/hooks";
import type { InputMethod } from "@diffgazer/core/onboarding";
import {
  getInitialWizardData,
  getPlanNotice,
  type OnboardingStep,
  useWizardState,
} from "@diffgazer/core/onboarding";
import { acceptNotice } from "@diffgazer/core/providers";
import type { RunnableProductId, WriteOnlySecretInput } from "@diffgazer/core/schemas/config";
import { useState } from "react";
import { useRegisterExitPreparation } from "../../../hooks/use-exit";
import { useNavigation } from "../../../hooks/use-navigation";
import { warnToTerminal } from "../../../lib/report-to-terminal";

type FocusArea = "step" | "nav";
type WizardFocusZone = "step" | "nav" | "api-key-method" | "api-key-input";

// Only the hosted credential step renders a method selector; local families
// show explanatory copy with no control, so they must not add a focus stop.
function getStepFocusZone(step: OnboardingStep, hasCredentialControls: boolean): WizardFocusZone {
  return step === "authentication" && hasCredentialControls ? "api-key-method" : "step";
}

function reportCleanupError(message: string): void {
  warnToTerminal(`Warning: ${message}`);
}

function inputMethodFromCredential(credential: WriteOnlySecretInput | undefined): InputMethod {
  return credential?.kind === "environment" ? "env" : "paste";
}

function credentialFromInput(method: InputMethod, apiKey: string): WriteOnlySecretInput {
  return method === "env" ? { kind: "environment" } : { kind: "literal", value: apiKey };
}

export function useOnboardingWizard() {
  const { navigate } = useNavigation();
  const saveSettings = useSaveSettings();
  const providerConsent = useSettings().data?.providerConsent ?? null;
  const runConfigurationAction = useConfigurationAction();
  const [focusZone, setFocusZone] = useState<WizardFocusZone>("step");
  const [navIndex, setNavIndex] = useState(0);
  const [apiKeyDraft, setApiKeyDraft] = useState("");

  const wizard = useWizardState({
    initial: getInitialWizardData(),
    callbacks: {
      saveSettings: (payload) => saveSettings.mutateAsync(payload),
      runConfigurationAction: (action) => runConfigurationAction.mutateAsync(action),
    },
    onComplete: () => navigate({ screen: "home" }),
    onCleanupError: reportCleanupError,
    providerConsent,
  });

  useRegisterExitPreparation(wizard.cleanupCreatedConfiguration);

  const wizardData = wizard.wizardData;
  const configurationInput = wizardData.configurationInput;
  const hostedCredential =
    configurationInput.transportFamily === "hosted-api" ? configurationInput.credential : undefined;
  const hasCredentialControls = configurationInput.transportFamily === "hosted-api";
  const effectiveInputMethod = inputMethodFromCredential(hostedCredential);
  const effectiveApiKey =
    hostedCredential?.kind === "literal" ? hostedCredential.value : apiKeyDraft;

  const isSaving = saveSettings.isPending || wizard.isSubmitting || wizard.isReconciling;
  const focusArea: FocusArea = focusZone === "nav" ? "nav" : "step";
  const apiKeyInputFocused = focusZone === "api-key-input";

  function syncCredentialDraft(method: InputMethod, apiKey: string) {
    if (configurationInput.transportFamily !== "hosted-api") return;
    wizard.updateData({
      configurationInput: {
        ...configurationInput,
        credential: credentialFromInput(method, apiKey),
      },
    });
  }

  function handleProductChange(productId: RunnableProductId) {
    wizard.setProduct(productId);
    setApiKeyDraft("");
    setFocusZone("step");
    setNavIndex(0);
  }

  function handleInputMethodChange(method: InputMethod) {
    syncCredentialDraft(method, effectiveApiKey);
  }

  function handleApiKeyChange(value: string) {
    setApiKeyDraft(value);
    syncCredentialDraft(effectiveInputMethod, value);
  }

  function handleModelChange(modelId: string) {
    wizard.updateData({ selectedModelId: modelId });
  }

  function handleAcknowledgementAccept() {
    wizard.updateData({ acknowledgement: acceptNotice(getPlanNotice(wizardData.plan)) });
  }

  function enterStep(step: OnboardingStep | undefined) {
    setFocusZone(step ? getStepFocusZone(step, hasCredentialControls) : "step");
    setNavIndex(0);
    // The model step reads models back from a persisted record, so the draft
    // tuple is committed as the user arrives rather than invented client-side.
    if (step === "model") void wizard.prepareDraftConfiguration();
  }

  function handleNext() {
    if (!wizard.canProceed) return;
    if (wizard.isLastStep) {
      void wizard.complete();
      return;
    }
    const nextStep = wizard.steps[wizard.stepIndex + 1];
    wizard.next();
    enterStep(nextStep);
  }

  function handleBack() {
    if (wizard.isFirstStep) return;
    const previousStep = wizard.steps[wizard.stepIndex - 1];
    wizard.back();
    enterStep(previousStep);
  }

  function toggleFocusArea() {
    setFocusZone((current) =>
      current === "nav" ? getStepFocusZone(wizard.currentStep, hasCredentialControls) : "nav",
    );
    setNavIndex(0);
  }

  function cycleFocusZone() {
    if (wizard.currentStep !== "authentication" || !hasCredentialControls) {
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
    if (effectiveInputMethod === "paste") {
      setFocusZone("api-key-input");
      return;
    }
    setFocusZone("nav");
    setNavIndex(wizard.isFirstStep ? 0 : 1);
  }

  function setApiKeyInputFocused(focused: boolean) {
    setFocusZone(focused ? "api-key-input" : "api-key-method");
  }

  function retryDraftConfiguration() {
    void wizard.prepareDraftConfiguration();
  }

  function moveNavIndex(direction: 1 | -1) {
    const buttonCount = wizard.isFirstStep ? 1 : 2;
    setNavIndex((index) => Math.max(0, Math.min(buttonCount - 1, index + direction)));
  }

  return {
    wizardData,
    currentStep: wizard.currentStep,
    stepIndex: wizard.stepIndex,
    steps: wizard.steps,
    plan: wizardData.plan,
    isFirstStep: wizard.isFirstStep,
    isLastStep: wizard.isLastStep,
    canProceed: wizard.canProceed,
    focusZone,
    focusArea,
    navIndex,
    apiKeyInputFocused,
    inputMethod: effectiveInputMethod,
    apiKey: effectiveApiKey,
    isSaving,
    error: wizard.error,
    draftConfiguration: wizard.draftConfiguration,
    isPreparingDraftConfiguration: wizard.isPreparingDraftConfiguration,

    retryDraftConfiguration,
    handleProductChange,
    handleInputMethodChange,
    handleApiKeyChange,
    handleModelChange,
    handleAcknowledgementAccept,
    handleNext,
    handleBack,
    cycleFocusZone,
    setApiKeyInputFocused,
    moveNavIndex,
    updateData: wizard.updateData,
  };
}
