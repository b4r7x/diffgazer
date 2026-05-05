import type { ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions.js";
import { Button } from "../../../components/ui/button.js";
import { Spinner } from "../../../components/ui/spinner.js";
import { Callout } from "../../../components/ui/callout.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { WizardProgress } from "./wizard-progress.js";
import { ProviderStep } from "./steps/provider-step.js";
import { ApiKeyMethodSelector } from "../../providers/components/api-key-method-selector.js";
import { ModelStep } from "./steps/model-step.js";
import { AnalysisSelector } from "../../settings/components/analysis-selector.js";
import { StorageSelector } from "../../settings/components/storage-selector.js";
import { ExecutionStep } from "./steps/execution-step.js";
import { useOnboardingWizard, STEP_LABELS, STEP_TITLES } from "../hooks/use-onboarding-wizard.js";

export function OnboardingWizard(): ReactElement {
  const { tokens } = useTheme();
  const { columns } = useTerminalDimensions();
  const wizard = useOnboardingWizard();

  useInput((_input, key) => {
    if (wizard.isSaving) return;
    if (key.tab) {
      wizard.toggleFocusArea();
    }
  });

  if (wizard.isSaving) {
    return (
      <Box justifyContent="center" flexGrow={1}>
        <Box width={Math.min(columns, 70)} flexDirection="column">
          <Box flexDirection="column" gap={1}>
            <WizardProgress steps={[...STEP_LABELS]} currentStep={wizard.currentStep} />
            <Spinner label="Saving configuration..." />
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box justifyContent="center" flexGrow={1}>
      <Box width={Math.min(columns, 70)} flexDirection="column">
        <Box flexDirection="column" gap={1}>
          <WizardProgress steps={[...STEP_LABELS]} currentStep={wizard.currentStep} />

          <SectionHeader>{STEP_TITLES[wizard.currentStep] ?? ""}</SectionHeader>

          {wizard.error !== null && (
            <Callout variant="error">
              <Callout.Content>{wizard.error}</Callout.Content>
            </Callout>
          )}

          <Box flexDirection="column" paddingLeft={1}>
            {wizard.currentStep === 0 && (
              <StorageSelector
                value={wizard.secretsStorage}
                onChange={wizard.handleSecretsStorageChange}
                isActive={wizard.focusArea === "step"}
              />
            )}
            {wizard.currentStep === 1 && (
              <ProviderStep
                value={wizard.provider}
                onChange={wizard.handleProviderChange}
                isActive={wizard.focusArea === "step"}
              />
            )}
            {wizard.currentStep === 2 && (
              <ApiKeyMethodSelector
                method={wizard.apiKeyMethod}
                onMethodChange={wizard.handleApiKeyMethodChange}
                apiKey={wizard.apiKey}
                onApiKeyChange={wizard.setApiKey}
                envVar={wizard.envVar}
                onEnvVarChange={wizard.setEnvVar}
                isActive={wizard.focusArea === "step"}
              />
            )}
            {wizard.currentStep === 3 && (
              <ModelStep
                value={wizard.model}
                onChange={wizard.setModel}
                provider={wizard.provider}
                isActive={wizard.focusArea === "step"}
              />
            )}
            {wizard.currentStep === 4 && (
              <AnalysisSelector
                selectedLenses={wizard.selectedLenses}
                onChange={wizard.setSelectedLenses}
                isActive={wizard.focusArea === "step"}
              />
            )}
            {wizard.currentStep === 5 && (
              <ExecutionStep
                value={wizard.agentExecution}
                onChange={wizard.handleAgentExecutionChange}
                isActive={wizard.focusArea === "step"}
              />
            )}
          </Box>

          <Box gap={2}>
            {!wizard.isFirstStep && (
              <Button
                variant="ghost"
                onPress={wizard.handleBack}
                isActive={wizard.focusArea === "nav"}
              >
                Back
              </Button>
            )}
            <Button
              variant="primary"
              onPress={wizard.handleNext}
              isActive={wizard.focusArea === "nav"}
            >
              {wizard.isLastStep ? "Complete" : "Next"}
            </Button>
          </Box>

          <Text color={tokens.muted} dimColor>
            Tab to switch focus  |  Arrow keys to navigate  |  Enter to select
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
