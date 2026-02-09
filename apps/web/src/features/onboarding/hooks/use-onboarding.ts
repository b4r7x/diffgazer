import { useState } from "react";
import { AVAILABLE_PROVIDERS } from "@diffgazer/schemas/config";
import type { AIProvider } from "@diffgazer/schemas/config";
import { LENS_IDS } from "@diffgazer/schemas/review";
import type { InputMethod } from "@/types/input-method";
import { useConfigActions } from "@/app/providers/config-provider";
import { api } from "@/lib/api";
import type { OnboardingStep, WizardData } from "../types";

const STEPS: OnboardingStep[] = ["storage", "provider", "api-key", "model", "analysis"];

const INITIAL_DATA: WizardData = {
  secretsStorage: "file",
  provider: null,
  apiKey: "",
  inputMethod: "paste",
  model: null,
  defaultLenses: [...LENS_IDS],
  agentExecution: "sequential",
};

export function useOnboarding() {
  const { refresh: refreshConfig } = useConfigActions();
  const [wizardData, setWizardData] = useState<WizardData>(INITIAL_DATA);
  const [stepIndex, setStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentStep = STEPS[stepIndex] ?? STEPS[0]!;
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEPS.length - 1;

  const canProceed = (() => {
    switch (currentStep) {
      case "storage":
        return true;
      case "provider":
        return wizardData.provider !== null;
      case "api-key":
        return wizardData.inputMethod === "env" || wizardData.apiKey.length > 0;
      case "model":
        return wizardData.model !== null;
      case "analysis":
        return wizardData.defaultLenses.length > 0;
    }
  })();

  const next = () => {
    if (!canProceed || isLastStep) return;
    setStepIndex(stepIndex + 1);
  };

  const back = () => {
    if (isFirstStep) return;
    setStepIndex(stepIndex - 1);
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
      await api.saveSettings({
        secretsStorage: wizardData.secretsStorage,
        defaultLenses: wizardData.defaultLenses,
        agentExecution: wizardData.agentExecution,
      });
      await api.saveConfig({
        provider: wizardData.provider,
        apiKey: wizardData.inputMethod === "env" ? "env" : wizardData.apiKey,
        model: wizardData.model ?? undefined,
      });
      await refreshConfig(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Setup failed");
      throw e;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    currentStep,
    wizardData,
    steps: STEPS,
    stepIndex,
    isFirstStep,
    isLastStep,
    canProceed,
    isSubmitting,
    error,
    next,
    back,
    updateData,
    setProvider,
    complete,
  };
}
