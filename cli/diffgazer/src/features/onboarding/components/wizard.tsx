import { usePageFooter } from "@diffgazer/core/footer";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type { LocalOpenAIPresetId } from "@diffgazer/core/schemas/config";
import { REMOVED_PRODUCT_ID } from "@diffgazer/core/schemas/config";
import { Box, Text, useInput } from "ink";
import type { ReactElement } from "react";
import { Button } from "../../../components/ui/button";
import { Callout } from "../../../components/ui/callout";
import { Input } from "../../../components/ui/input";
import { RadioGroup } from "../../../components/ui/radio";
import { SectionHeader } from "../../../components/ui/section-header";
import { Spinner } from "../../../components/ui/spinner";
import { useActionRow } from "../../../hooks/use-action-row";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions";
import { useTheme } from "../../../theme/provider";
import { useOnboardingWizard } from "../hooks/use-wizard";
import { getStepLabelList, getStepShortcuts, STEP_TITLES } from "../lib/step-shortcuts";
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
  if (wizard.wizardData.kind !== "runnable") return null;
  const draft = wizard.wizardData;
  const step = draft.plan.steps.find((candidate) => candidate.id === "endpoint-binding");
  if (!step || step.id !== "endpoint-binding") return null;
  const input = draft.configurationInput;
  const isActive = wizard.focusArea === "step";

  if (input.transportFamily === "hosted-api") {
    const endpoints = step.endpoints;
    const selectedEndpoint =
      endpoints.find((endpoint) => endpoint.endpoint === input.endpoint) ?? endpoints[0];
    return (
      <Box flexDirection="column" gap={1}>
        <Text color={tokens.muted}>Choose the endpoint profile for this hosted product.</Text>
        {step.requiredFields.includes("region") ? (
          <RadioGroup
            value={input.region ?? selectedEndpoint?.region ?? ""}
            onChange={(region) => {
              const endpoint = endpoints.find((candidate) => candidate.region === region);
              if (!endpoint || !("region" in endpoint)) return;
              wizard.updateData({
                configurationInput: {
                  ...input,
                  endpoint: endpoint.endpoint,
                  region: endpoint.region,
                },
              });
            }}
            isActive={isActive}
          >
            {endpoints.map((endpoint) =>
              "region" in endpoint ? (
                <RadioGroup.Item
                  key={endpoint.region ?? endpoint.endpoint}
                  value={endpoint.region ?? ""}
                  label={endpoint.region ?? ""}
                  description={endpoint.endpoint}
                />
              ) : null,
            )}
          </RadioGroup>
        ) : null}
        {step.requiredFields.includes("workspace") ? (
          <Box flexDirection="column" gap={1}>
            <Text color={tokens.muted}>Workspace reference</Text>
            <Input
              value={input.workspace ?? ""}
              onChange={(workspace) =>
                wizard.updateData({
                  configurationInput: { ...input, workspace },
                })
              }
              isActive={isActive}
            />
          </Box>
        ) : null}
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
            wizard.updateData({
              configurationInput: {
                ...input,
                endpoint,
                ...(profile && "id" in profile
                  ? { presetId: profile.id as LocalOpenAIPresetId }
                  : {}),
              },
            });
          }}
          isActive={isActive}
        >
          {step.endpoints.map((endpoint) => (
            <RadioGroup.Item
              key={endpoint.endpoint}
              value={endpoint.endpoint}
              label={endpoint.endpoint}
            />
          ))}
        </RadioGroup>
      </Box>
    );
  }

  return null;
}

function ConformanceStep({ wizard }: WizardStepBodyProps): ReactElement | null {
  const { tokens } = useTheme();
  if (wizard.wizardData.kind !== "runnable") return null;
  const step = wizard.wizardData.plan.steps.find((candidate) => candidate.id === "conformance");
  if (!step || step.id !== "conformance") return null;

  return (
    <Box flexDirection="column" gap={1}>
      <Text color={tokens.muted}>
        Structured review conformance is required before this configuration can run reviews.
      </Text>
      <Text color={tokens.muted}>
        Usage reporting: {step.usage}. Structured output: {step.structuredOutput}.
      </Text>
      <Button
        variant="secondary"
        onPress={wizard.handleConformanceConfirm}
        isActive={wizard.focusArea === "step"}
        disabled={wizard.wizardData.conformanceStatus === "passed"}
      >
        {wizard.wizardData.conformanceStatus === "passed"
          ? "Conformance confirmed"
          : "Confirm conformance requirements"}
      </Button>
    </Box>
  );
}

function AcknowledgementStep({ wizard }: WizardStepBodyProps): ReactElement | null {
  const { tokens } = useTheme();
  if (wizard.wizardData.kind !== "runnable") return null;
  const step = wizard.wizardData.plan.steps.find((candidate) => candidate.id === "acknowledgement");
  if (!step || step.id !== "acknowledgement") return null;
  const notice = step.notice;
  const accepted = wizard.wizardData.acknowledgement.status === "accepted";

  return (
    <Box flexDirection="column" gap={1}>
      {notice.billing.map((line) => (
        <Text key={line} color={tokens.muted}>
          {line}
        </Text>
      ))}
      {notice.privacy.map((line) => (
        <Text key={line} color={tokens.muted}>
          {line}
        </Text>
      ))}
      <Button
        variant="secondary"
        onPress={wizard.handleAcknowledgementAccept}
        isActive={wizard.focusArea === "step"}
        disabled={accepted}
      >
        {accepted ? "Notice accepted" : "Accept billing and privacy notice"}
      </Button>
    </Box>
  );
}

function MigrationStep({ wizard }: WizardStepBodyProps): ReactElement | null {
  const { tokens } = useTheme();
  if (wizard.wizardData.kind !== "removed") return null;
  const step = wizard.wizardData.plan.steps.find((candidate) => candidate.id === "migration");
  if (!step || step.id !== "migration") return null;

  return (
    <Box flexDirection="column" gap={1}>
      <Text color={tokens.warning}>
        Create a new general Z.AI PAYG configuration. The removed {REMOVED_PRODUCT_ID} record is
        retained until you explicitly delete it. Old secrets are never copied, tested, or sent.
      </Text>
      <Text color={tokens.muted}>
        Target product: {PRODUCT_REGISTRY[step.targetProductId].presentation.name}
      </Text>
    </Box>
  );
}

function DeleteRemovedStep({ wizard }: WizardStepBodyProps): ReactElement | null {
  const { tokens } = useTheme();
  if (wizard.wizardData.kind !== "removed") return null;

  return (
    <Box flexDirection="column" gap={1}>
      <Text color={tokens.warning}>
        Delete the removed {REMOVED_PRODUCT_ID} record after you create a supported replacement
        configuration.
      </Text>
    </Box>
  );
}

function WizardStepBody({ wizard }: WizardStepBodyProps): ReactElement | null {
  const isStepFocused = wizard.focusArea === "step";
  switch (wizard.currentStep) {
    case "product":
      if (wizard.wizardData.kind !== "runnable") return null;
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
      if (wizard.wizardData.kind !== "runnable") return null;
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
      if (wizard.wizardData.kind !== "runnable") return null;
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
    case "conformance":
      return <ConformanceStep wizard={wizard} />;
    case "acknowledgement":
      return <AcknowledgementStep wizard={wizard} />;
    case "migration":
      return <MigrationStep wizard={wizard} />;
    case "delete":
      return <DeleteRemovedStep wizard={wizard} />;
  }
}

export function OnboardingWizard(): ReactElement {
  const { columns } = useTerminalDimensions();
  const wizard = useOnboardingWizard();
  const stepLabels = getStepLabelList(wizard.steps);
  const fullProgressWidth = getFullProgressWidth(
    stepLabels.map((label) => label.charAt(0).toUpperCase() + label.slice(1)),
  );
  const compactProgress = columns < fullProgressWidth;
  const nextActionIndex = wizard.isFirstStep ? 0 : 1;
  const transportFamily =
    wizard.wizardData.kind === "runnable"
      ? wizard.wizardData.configurationInput.transportFamily
      : undefined;

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

  let primaryLabel = "Next";
  if (wizard.wizardData.kind === "removed" && wizard.currentStep === "delete") {
    primaryLabel = "Delete Record";
  } else if (wizard.isLastStep) {
    primaryLabel = "Complete Setup";
  }

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
