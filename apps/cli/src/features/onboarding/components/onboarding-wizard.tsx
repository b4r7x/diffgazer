import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import type { LensId } from "@diffgazer/schemas/review";
import type { AIProvider, SecretsStorage, AgentExecution } from "@diffgazer/schemas/config";
import { useTheme } from "../../../theme/theme-context.js";
import { useNavigation } from "../../../app/navigation-context.js";
import { useSaveSettings, useSaveConfig } from "@diffgazer/api/hooks";
import { Button } from "../../../components/ui/button.js";
import { Spinner } from "../../../components/ui/spinner.js";
import { Callout } from "../../../components/ui/callout.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { WizardProgress } from "./wizard-progress.js";
import { ProviderStep } from "./steps/provider-step.js";
import { ApiKeyStep } from "./steps/api-key-step.js";
import { ModelStep } from "./steps/model-step.js";
import { AnalysisStep } from "./steps/analysis-step.js";
import { StorageStep } from "./steps/storage-step.js";
import { ExecutionStep } from "./steps/execution-step.js";

const stepLabels = [
  "Provider",
  "API Key",
  "Model",
  "Analysis",
  "Storage",
  "Execution",
];

export function OnboardingWizard(): ReactElement {
  const { tokens } = useTheme();
  const { navigate } = useNavigation();

  const [currentStep, setCurrentStep] = useState(0);
  const [provider, setProvider] = useState<AIProvider>("gemini");
  const [apiKeyMethod, setApiKeyMethod] = useState("paste");
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

  const saveSettings = useSaveSettings();
  const saveConfig = useSaveConfig();

  const isSaving = saveSettings.isPending || saveConfig.isPending;
  const [error, setError] = useState<string | null>(null);

  const isLastStep = currentStep === stepLabels.length - 1;
  const isFirstStep = currentStep === 0;

  const [focusArea, setFocusArea] = useState<"step" | "nav">("step");

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
      setError(e instanceof Error ? e.message : "Setup failed");
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

  useInput((_input, key) => {
    if (isSaving) return;
    if (key.tab) {
      setFocusArea(focusArea === "step" ? "nav" : "step");
    }
  });

  const stepTitles: Record<number, string> = {
    0: "Choose your AI provider",
    1: "Configure API key",
    2: "Select a model",
    3: "Choose analysis agents",
    4: "Secret storage method",
    5: "Agent execution mode",
  };

  if (isSaving) {
    return (
      <Box flexDirection="column" gap={1}>
        <WizardProgress steps={stepLabels} currentStep={currentStep} />
        <Spinner label="Saving configuration..." />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <WizardProgress steps={stepLabels} currentStep={currentStep} />

      <SectionHeader>{stepTitles[currentStep] ?? ""}</SectionHeader>

      {error !== null && (
        <Callout variant="error">
          <Callout.Content>{error}</Callout.Content>
        </Callout>
      )}

      <Box flexDirection="column" paddingLeft={1}>
        {currentStep === 0 && (
          <ProviderStep
            value={provider}
            onChange={(v) => setProvider(v as AIProvider)}
            isActive={focusArea === "step"}
          />
        )}
        {currentStep === 1 && (
          <ApiKeyStep
            method={apiKeyMethod}
            onMethodChange={setApiKeyMethod}
            apiKey={apiKey}
            onApiKeyChange={setApiKey}
            envVar={envVar}
            onEnvVarChange={setEnvVar}
            isActive={focusArea === "step"}
          />
        )}
        {currentStep === 2 && (
          <ModelStep
            value={model}
            onChange={setModel}
            provider={provider}
            isActive={focusArea === "step"}
          />
        )}
        {currentStep === 3 && (
          <AnalysisStep
            selectedLenses={selectedLenses}
            onChange={setSelectedLenses}
            isActive={focusArea === "step"}
          />
        )}
        {currentStep === 4 && (
          <StorageStep
            value={secretsStorage}
            onChange={(v) => setSecretsStorage(v as SecretsStorage)}
            isActive={focusArea === "step"}
          />
        )}
        {currentStep === 5 && (
          <ExecutionStep
            value={agentExecution}
            onChange={(v) => setAgentExecution(v as AgentExecution)}
            isActive={focusArea === "step"}
          />
        )}
      </Box>

      <Box gap={2}>
        {!isFirstStep && (
          <Button
            variant="ghost"
            onPress={handleBack}
            isActive={focusArea === "nav"}
          >
            Back
          </Button>
        )}
        <Button
          variant="primary"
          onPress={handleNext}
          isActive={focusArea === "nav"}
        >
          {isLastStep ? "Complete" : "Next"}
        </Button>
      </Box>

      <Text color={tokens.muted} dimColor>
        Tab to switch focus  |  Arrow keys to navigate  |  Enter to select
      </Text>
    </Box>
  );
}
