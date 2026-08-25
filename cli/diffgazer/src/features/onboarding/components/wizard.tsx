import { usePageFooter } from "@diffgazer/core/footer";
import { STEP_LABELS, STEP_TITLES } from "@diffgazer/core/onboarding";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { LocalOpenAIPresetIdSchema, PROVIDER_CONSENT_TEXT } from "@diffgazer/core/schemas/config";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { Button } from "../../../components/ui/button";
import { Callout } from "../../../components/ui/callout";
import { RadioGroup } from "../../../components/ui/radio";
import { SectionHeader } from "../../../components/ui/section-header";
import { Spinner } from "../../../components/ui/spinner";
import { useActionRow } from "../../../hooks/use-action-row";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions";
import { useTheme } from "../../../theme/provider";
import { useOnboardingWizard } from "../hooks/use-wizard";
import { getStepShortcuts } from "../lib/step-shortcuts";
import { getFullProgressWidth } from "../lib/wizard-progress";
import { ApiKeyStep } from "./steps/api-key-step";
import { ModelStep } from "./steps/model-step";
import { ProviderStep } from "./steps/provider-step";
import { WizardProgress } from "./wizard-progress";

interface WizardStepBodyProps {
  wizard: ReturnType<typeof useOnboardingWizard>;
}

function EndpointBindingStep({ wizard }: WizardStepBodyProps): ReactElement | null {
  const { tokens } = useTheme();
  const draft = wizard.wizardData;
  const step = draft.plan.steps.find((candidate) => candidate.id === "endpoint-binding");
  if (!step || step.id !== "endpoint-binding") return null;
  const input = draft.configurationInput;
  const isActive = wizard.focusArea === "step";

  if (input.transportFamily === "hosted-api") {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={tokens.muted}>Choose the endpoint profile for this hosted product.</Text>
        <RadioGroup
          value={input.endpoint}
          onChange={(endpoint) => wizard.updateData({ configurationInput: { ...input, endpoint } })}
          isActive={isActive}
        >
          {step.endpoints.map((endpoint) => (
            <RadioGroup.Item
              key={endpoint.endpoint}
              value={endpoint.endpoint}
              label={endpoint.label}
              description={endpoint.endpoint}
            />
          ))}
        </RadioGroup>
      </Box>
    );
  }

  if (input.transportFamily === "local-http") {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={tokens.muted}>Choose the loopback endpoint for this local server.</Text>
        <RadioGroup
          value={input.endpoint}
          onChange={(endpoint) => {
            const profile = step.endpoints.find((candidate) => candidate.endpoint === endpoint);
            const nextInput = { ...input, endpoint };
            if (input.productId !== "local-openai" || !profile) {
              wizard.updateData({ configurationInput: nextInput });
              return;
            }
            // The schema that owns this id is the only thing allowed to widen it,
            // so a future third preset skips the selection instead of throwing out
            // of the key handler, which has no boundary to land in.
            const presetId = LocalOpenAIPresetIdSchema.safeParse(profile.id);
            if (!presetId.success) return;
            wizard.updateData({
              configurationInput: { ...nextInput, presetId: presetId.data },
            });
          }}
          isActive={isActive}
        >
          {step.endpoints.map((endpoint) => (
            <RadioGroup.Item
              key={endpoint.endpoint}
              value={endpoint.endpoint}
              label={endpoint.label}
              description={endpoint.endpoint}
            />
          ))}
        </RadioGroup>
      </Box>
    );
  }

  return null;
}

function AcknowledgementStep({ wizard }: WizardStepBodyProps): ReactElement | null {
  const { tokens } = useTheme();
  const step = wizard.wizardData.plan.steps.find((candidate) => candidate.id === "acknowledgement");
  if (!step || step.id !== "acknowledgement") return null;
  const notice = step.notice;
  const accepted = wizard.wizardData.acknowledgement.status === "accepted";

  return (
    <Box flexDirection="column" gap={1}>
      <Text>{PROVIDER_CONSENT_TEXT}</Text>
      <Box flexDirection="column">
        <Text color={tokens.muted}>
          {PRODUCT_REGISTRY[wizard.plan.productId].presentation.name} notice:
        </Text>
        {[...notice.billing, ...notice.privacy].map((line) => (
          <Text key={line} color={tokens.muted}>
            {line}
          </Text>
        ))}
      </Box>
      <Button
        variant="secondary"
        onPress={wizard.handleAcknowledgementAccept}
        isActive={wizard.focusArea === "step"}
        disabled={accepted}
      >
        {accepted ? "Accepted" : "Accept"}
      </Button>
    </Box>
  );
}

function WizardStepBody({ wizard }: WizardStepBodyProps): ReactElement | null {
  const isStepFocused = wizard.focusArea === "step";
  switch (wizard.currentStep) {
    case "product":
      return (
        <ProviderStep
          value={wizard.wizardData.configurationInput.productId}
          onChange={wizard.handleProductChange}
          isActive={isStepFocused}
        />
      );
    case "endpoint-binding":
      return <EndpointBindingStep wizard={wizard} />;
    case "authentication":
      return (
        <ApiKeyStep
          productId={wizard.wizardData.configurationInput.productId}
          transportFamily={wizard.wizardData.configurationInput.transportFamily}
          method={wizard.inputMethod}
          onMethodChange={wizard.handleInputMethodChange}
          apiKey={wizard.apiKey}
          onApiKeyChange={wizard.handleApiKeyChange}
          isActive={isStepFocused}
          inputFocused={wizard.apiKeyInputFocused}
          onInputFocusedChange={wizard.setApiKeyInputFocused}
        />
      );
    case "model":
      return (
        <ModelStep
          configuration={wizard.draftConfiguration}
          isPreparing={wizard.isPreparingDraftConfiguration}
          onRetry={wizard.retryDraftConfiguration}
          value={wizard.wizardData.selectedModelId}
          onChange={wizard.handleModelChange}
          isActive={isStepFocused}
        />
      );
    case "acknowledgement":
      return <AcknowledgementStep wizard={wizard} />;
  }
}

export function OnboardingWizard(): ReactElement {
  const { columns } = useTerminalDimensions();
  const wizard = useOnboardingWizard();
  const stepLabels = wizard.steps.map((step) => STEP_LABELS[step]);
  const fullProgressWidth = getFullProgressWidth(stepLabels);
  const compactProgress = columns < fullProgressWidth;
  const nextActionIndex = wizard.isFirstStep ? 0 : 1;
  const transportFamily = wizard.wizardData.configurationInput.transportFamily;

  const actions = useActionRow({
    actionCount: wizard.isFirstStep ? 1 : 2,
    disabledActions: wizard.isFirstStep ? [!wizard.canProceed] : [false, !wizard.canProceed],
    onAction: (index) => (index === nextActionIndex ? wizard.handleNext() : wizard.handleBack()),
    isActive: wizard.focusArea === "nav" && !wizard.isSaving,
    activeIndex: wizard.navIndex,
    onNavigate: (index) => {
      if (index > wizard.navIndex) wizard.moveNavIndex(1);
      if (index < wizard.navIndex) wizard.moveNavIndex(-1);
    },
  });

  usePageFooter({
    shortcuts: getStepShortcuts({
      currentStep: wizard.currentStep,
      focusArea: wizard.focusArea,
      navIndex: wizard.navIndex,
      isFirstStep: wizard.isFirstStep,
      isLastStep: wizard.isLastStep,
      canProceed: wizard.canProceed,
      inputMethod: wizard.inputMethod,
      apiKeyInputFocused: wizard.apiKeyInputFocused,
      transportFamily,
    }),
  });

  useInput((_input, key) => {
    if (wizard.isSaving) return;
    if (key.tab) wizard.cycleFocusZone();
  });

  const primaryLabel = wizard.isLastStep ? "Complete Setup" : "Next";

  if (wizard.isSaving) {
    return (
      <Box justifyContent="center" flexGrow={1}>
        <Box width={Math.min(columns, fullProgressWidth)} flexDirection="column">
          <Box flexDirection="column" gap={1}>
            <WizardProgress
              plan={wizard.plan}
              currentStep={wizard.stepIndex}
              compact={compactProgress}
            />
            <Spinner label="Saving configuration..." />
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box justifyContent="center" flexGrow={1}>
      <Box width={Math.min(columns, fullProgressWidth)} flexDirection="column">
        <Box flexDirection="column" gap={1}>
          <WizardProgress
            plan={wizard.plan}
            currentStep={wizard.stepIndex}
            compact={compactProgress}
          />

          <SectionHeader>{STEP_TITLES[wizard.currentStep]}</SectionHeader>

          {wizard.error !== null && (
            <Callout variant="error">
              <Callout.Content>{wizard.error}</Callout.Content>
            </Callout>
          )}

          <Box flexDirection="column" paddingLeft={1}>
            <WizardStepBody wizard={wizard} />
          </Box>

          <Box gap={2}>
            {!wizard.isFirstStep && (
              <Button
                variant="ghost"
                onPress={() => actions.activate(0)}
                isActive={actions.isActionActive(0)}
              >
                Back
              </Button>
            )}
            <Button
              variant="primary"
              onPress={() => actions.activate(nextActionIndex)}
              isActive={actions.isActionActive(nextActionIndex)}
              disabled={!wizard.canProceed}
            >
              {primaryLabel}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
