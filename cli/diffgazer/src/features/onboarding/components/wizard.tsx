import { usePageFooter } from "@diffgazer/core/footer";
import {
  type OnboardingStep,
  STEP_LABELS,
  STEP_TITLES,
  WIZARD_STEPS,
} from "@diffgazer/core/onboarding";
import { Box, useInput } from "ink";
import { type ReactElement, useEffect, useEffectEvent } from "react";
import { Button } from "../../../components/ui/button";
import { Callout } from "../../../components/ui/callout";
import { SectionHeader } from "../../../components/ui/section-header";
import { Spinner } from "../../../components/ui/spinner";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions";
import { useOnboardingWizard } from "../hooks/use-wizard";
import { apiKeyStepOwnsTab } from "../lib/api-key-tab";
import { getStepShortcuts } from "../lib/step-shortcuts";
import { AnalysisStep } from "./steps/analysis-step";
import { ApiKeyStep } from "./steps/api-key-step";
import { ExecutionStep } from "./steps/execution-step";
import { ModelStep } from "./steps/model-step";
import { ProviderStep } from "./steps/provider-step";
import { StorageStep } from "./steps/storage-step";
import { WizardProgress } from "./wizard-progress";

const STEP_LABEL_LIST = WIZARD_STEPS.map((step) => STEP_LABELS[step]);

interface WizardStepBodyProps {
  step: OnboardingStep;
  wizard: ReturnType<typeof useOnboardingWizard>;
}

function WizardStepBody({ step, wizard }: WizardStepBodyProps): ReactElement | null {
  const isStepFocused = wizard.focusArea === "step";
  switch (step) {
    case "storage":
      return (
        <StorageStep
          value={wizard.wizardData.secretsStorage}
          onChange={wizard.handleSecretsStorageChange}
          isActive={isStepFocused}
        />
      );
    case "provider":
      return (
        <ProviderStep
          value={wizard.wizardData.provider ?? undefined}
          onChange={wizard.handleProviderChange}
          isActive={isStepFocused}
        />
      );
    case "api-key":
      if (!wizard.wizardData.provider) return null;
      return (
        <ApiKeyStep
          provider={wizard.wizardData.provider}
          method={wizard.wizardData.inputMethod}
          onMethodChange={wizard.handleInputMethodChange}
          apiKey={wizard.wizardData.apiKey}
          onApiKeyChange={wizard.handleApiKeyChange}
          isActive={isStepFocused}
          inputFocused={wizard.apiKeyInputFocused}
          onInputFocusedChange={wizard.setApiKeyInputFocused}
        />
      );
    case "model":
      if (!wizard.wizardData.provider) return null;
      return (
        <ModelStep
          provider={wizard.wizardData.provider}
          value={wizard.wizardData.model ?? undefined}
          onChange={wizard.handleModelChange}
          isActive={isStepFocused}
        />
      );
    case "analysis":
      return (
        <AnalysisStep
          selectedLenses={wizard.wizardData.defaultLenses}
          onChange={wizard.handleLensesChange}
          isActive={isStepFocused}
        />
      );
    case "execution":
      return (
        <ExecutionStep
          value={wizard.wizardData.agentExecution}
          onChange={wizard.handleAgentExecutionChange}
          isActive={isStepFocused}
        />
      );
  }
}

export function OnboardingWizard(): ReactElement {
  const { columns } = useTerminalDimensions();
  const wizard = useOnboardingWizard();

  const cleanupEarlySave = useEffectEvent(() => {
    void wizard.cleanupEarlySave();
  });

  useEffect(() => {
    return () => {
      cleanupEarlySave();
    };
  }, []);

  usePageFooter({
    shortcuts: getStepShortcuts(wizard.currentStep, wizard.focusArea, !wizard.canProceed),
  });

  useInput((_input, key) => {
    if (wizard.isSaving) return;
    if (key.tab) {
      // The api-key step owns Tab while its body is focused (toggles the key
      // input), so the wizard must not also toggle the step/nav focus area.
      if (apiKeyStepOwnsTab(wizard.currentStep, wizard.focusArea)) {
        wizard.toggleApiKeyInputFocus();
        return;
      }
      wizard.toggleFocusArea();
      return;
    }
    if (wizard.focusArea === "nav") {
      if (key.leftArrow) {
        wizard.moveNavIndex(-1);
        return;
      }
      if (key.rightArrow) {
        wizard.moveNavIndex(1);
      }
    }
  });

  if (wizard.isSaving) {
    return (
      <Box justifyContent="center" flexGrow={1}>
        <Box width={Math.min(columns, 70)} flexDirection="column">
          <Box flexDirection="column" gap={1}>
            <WizardProgress steps={STEP_LABEL_LIST} currentStep={wizard.stepIndex} />
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
          <WizardProgress steps={STEP_LABEL_LIST} currentStep={wizard.stepIndex} />

          <SectionHeader>{STEP_TITLES[wizard.currentStep]}</SectionHeader>

          {wizard.error !== null && (
            <Callout variant="error">
              <Callout.Content>{wizard.error}</Callout.Content>
            </Callout>
          )}

          <Box flexDirection="column" paddingLeft={1}>
            <WizardStepBody step={wizard.currentStep} wizard={wizard} />
          </Box>

          <Box gap={2}>
            {!wizard.isFirstStep && (
              <Button
                variant="ghost"
                onPress={wizard.handleBack}
                isActive={wizard.focusArea === "nav" && wizard.navIndex === 0}
              >
                Back
              </Button>
            )}
            <Button
              variant="primary"
              onPress={wizard.handleNext}
              isActive={
                wizard.focusArea === "nav" && wizard.navIndex === (wizard.isFirstStep ? 0 : 1)
              }
              disabled={!wizard.canProceed}
            >
              {wizard.isLastStep ? "Complete Setup" : "Next"}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
