import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { Button } from "../../../components/ui/button.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { WizardProgress } from "./wizard-progress.js";
import { ProviderStep } from "./steps/provider-step.js";
import { ApiKeyStep } from "./steps/api-key-step.js";
import { ModelStep } from "./steps/model-step.js";
import { AnalysisStep } from "./steps/analysis-step.js";
import { StorageStep } from "./steps/storage-step.js";
import { ExecutionStep } from "./steps/execution-step.js";

interface OnboardingWizardProps {
  onComplete: () => void;
}

const stepLabels = [
  "Provider",
  "API Key",
  "Model",
  "Analysis",
  "Storage",
  "Execution",
];

const defaultAgents = ["security", "correctness", "performance"];

export function OnboardingWizard({
  onComplete,
}: OnboardingWizardProps): ReactElement {
  const { tokens } = useTheme();

  const [currentStep, setCurrentStep] = useState(0);
  const [provider, setProvider] = useState("");
  const [apiKeyMethod, setApiKeyMethod] = useState("paste");
  const [apiKey, setApiKey] = useState("");
  const [envVar, setEnvVar] = useState("");
  const [model, setModel] = useState("");
  const [agents, setAgents] = useState<string[]>(defaultAgents);
  const [storage, setStorage] = useState("file");
  const [execution, setExecution] = useState("parallel");

  const isLastStep = currentStep === stepLabels.length - 1;
  const isFirstStep = currentStep === 0;

  const [focusArea, setFocusArea] = useState<"step" | "nav">("step");

  function handleNext() {
    if (isLastStep) {
      onComplete();
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

  return (
    <Box flexDirection="column" gap={1}>
      <WizardProgress steps={stepLabels} currentStep={currentStep} />

      <SectionHeader>{stepTitles[currentStep] ?? ""}</SectionHeader>

      <Box flexDirection="column" paddingLeft={1}>
        {currentStep === 0 && (
          <ProviderStep
            value={provider}
            onChange={setProvider}
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
            selectedAgents={agents}
            onChange={setAgents}
            isActive={focusArea === "step"}
          />
        )}
        {currentStep === 4 && (
          <StorageStep
            value={storage}
            onChange={setStorage}
            isActive={focusArea === "step"}
          />
        )}
        {currentStep === 5 && (
          <ExecutionStep
            value={execution}
            onChange={setExecution}
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
