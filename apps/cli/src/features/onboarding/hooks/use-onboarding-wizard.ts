import { useState } from "react";
import { getErrorMessage } from "@diffgazer/core/errors";
import type { LensId } from "@diffgazer/schemas/review";
import type { AIProvider, SecretsStorage, AgentExecution } from "@diffgazer/schemas/config";
import { AI_PROVIDERS } from "@diffgazer/schemas/config";
import { SECRETS_STORAGE, AGENT_EXECUTION_MODES } from "@diffgazer/schemas/config";
import { useNavigation } from "../../../app/navigation-context.js";
import { useSaveSettings, useSaveConfig } from "@diffgazer/api/hooks";

const API_KEY_METHODS = ["paste", "env"] as const;
type ApiKeyMethod = (typeof API_KEY_METHODS)[number];

function isSecretsStorage(v: string): v is SecretsStorage {
  return (SECRETS_STORAGE as readonly string[]).includes(v);
}

function isAIProvider(v: string): v is AIProvider {
  return (AI_PROVIDERS as readonly string[]).includes(v);
}

function isAgentExecution(v: string): v is AgentExecution {
  return (AGENT_EXECUTION_MODES as readonly string[]).includes(v);
}

function isApiKeyMethod(v: string): v is ApiKeyMethod {
  return (API_KEY_METHODS as readonly string[]).includes(v);
}

export const STEP_LABELS = [
  "Storage",
  "Provider",
  "API Key",
  "Model",
  "Analysis",
  "Execution",
] as const;

export const STEP_TITLES: Record<number, string> = {
  0: "Secret storage method",
  1: "Choose your AI provider",
  2: "Configure API key",
  3: "Select a model",
  4: "Choose analysis agents",
  5: "Agent execution mode",
};

export function useOnboardingWizard() {
  const { navigate } = useNavigation();

  const [currentStep, setCurrentStep] = useState(0);
  const [provider, setProvider] = useState<AIProvider>("gemini");
  const [apiKeyMethod, setApiKeyMethod] = useState<ApiKeyMethod>("paste");
  const [apiKey, setApiKey] = useState("");
  const [envVar, setEnvVar] = useState("");
  const [model, setModel] = useState("");
  const [selectedLenses, setSelectedLenses] = useState<LensId[]>([
    "security",
    "correctness",
    "performance",
  ]);
  const [secretsStorage, setSecretsStorage] = useState<SecretsStorage>("file");
  const [agentExecution, setAgentExecution] = useState<AgentExecution>("parallel");
  const [error, setError] = useState<string | null>(null);
  const [focusArea, setFocusArea] = useState<"step" | "nav">("step");

  const saveSettings = useSaveSettings();
  const saveConfig = useSaveConfig();

  const isSaving = saveSettings.isPending || saveConfig.isPending;
  const isLastStep = currentStep === STEP_LABELS.length - 1;
  const isFirstStep = currentStep === 0;

  function handleProviderChange(v: string) {
    if (isAIProvider(v)) setProvider(v);
  }

  function handleSecretsStorageChange(v: string) {
    if (isSecretsStorage(v)) setSecretsStorage(v);
  }

  function handleAgentExecutionChange(v: string) {
    if (isAgentExecution(v)) setAgentExecution(v);
  }

  function handleApiKeyMethodChange(v: string) {
    if (isApiKeyMethod(v)) setApiKeyMethod(v);
  }

  async function handleComplete() {
    setError(null);
    try {
      await saveSettings.mutateAsync({
        secretsStorage,
        defaultLenses: selectedLenses,
        agentExecution,
      });
      await saveConfig.mutateAsync({
        provider,
        apiKey: apiKeyMethod === "env" ? "env" : apiKey,
        model: model || undefined,
      });
      navigate({ screen: "home" });
    } catch (e) {
      setError(getErrorMessage(e, "Setup failed"));
    }
  }

  function handleNext() {
    if (isLastStep) {
      void handleComplete();
    } else {
      setCurrentStep(currentStep + 1);
      setFocusArea("step");
    }
  }

  function handleBack() {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1);
      setFocusArea("step");
    }
  }

  function toggleFocusArea() {
    setFocusArea(focusArea === "step" ? "nav" : "step");
  }

  return {
    currentStep,
    provider,
    apiKeyMethod,
    apiKey,
    envVar,
    model,
    selectedLenses,
    secretsStorage,
    agentExecution,
    error,
    focusArea,
    isSaving,
    isLastStep,
    isFirstStep,

    setApiKey,
    setEnvVar,
    setModel,
    setSelectedLenses,
    handleProviderChange,
    handleSecretsStorageChange,
    handleAgentExecutionChange,
    handleApiKeyMethodChange,
    handleNext,
    handleBack,
    toggleFocusArea,
  };
}
