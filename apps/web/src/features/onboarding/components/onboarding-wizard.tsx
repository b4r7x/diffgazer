import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CardLayout } from "@/components/ui/card-layout";
import { Button } from "@diffgazer/ui/components/button";
import { Callout } from "@diffgazer/ui/components/callout";
import { cn } from "@diffgazer/ui/lib/utils";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { usePageFooter } from "@diffgazer/core/footer";
import { useActionRowNavigation } from "@diffgazer/keys";
import { useScope } from "@diffgazer/keys";
import { useOnboarding } from "../hooks/use-onboarding";
import { HorizontalStepper } from "@diffgazer/ui/components/horizontal-stepper";
import { StorageStep } from "./steps/storage-step";
import { ProviderStep } from "./steps/provider-step";
import { ApiKeyStep } from "./steps/api-key-step";
import { ModelStep } from "./steps/model-step";
import { AnalysisStep } from "./steps/analysis-step";
import { ExecutionStep } from "./steps/execution-step";
import type { AgentExecution } from "@diffgazer/core/schemas/config";
import {
  canProceed as canProceedForStep,
  type OnboardingStep,
  type WizardData,
} from "@diffgazer/core/onboarding";

const STEP_TITLES: Record<OnboardingStep, string> = {
  storage: "Secrets Storage",
  provider: "AI Provider",
  "api-key": "API Key",
  model: "Model Selection",
  analysis: "Analysis Configuration",
  execution: "Agent Execution",
};

const STEP_LABELS: Record<OnboardingStep, string> = {
  storage: "Storage",
  provider: "Provider",
  "api-key": "API Key",
  model: "Model",
  analysis: "Analysis",
  execution: "Execution",
};

function getStepShortcuts(
  currentStep: OnboardingStep,
  isButtonsZone: boolean,
  actionDisabled = false,
): Shortcut[] {
  if (isButtonsZone) {
    return [
      { key: "←/→", label: "Move Action" },
      { key: "Enter/Space", label: "Activate Action", disabled: actionDisabled },
      { key: "↑", label: "Back to Options" },
    ];
  }

  switch (currentStep) {
    case "storage":
      return [
        { key: "↑/↓", label: "Navigate" },
        { key: "Space", label: "Select Storage" },
        { key: "Enter", label: "Select & Next" },
        { key: "↓", label: "Focus Actions" },
      ];
    case "provider":
      return [
        { key: "↑/↓", label: "Navigate Providers" },
        { key: "Space", label: "Select Provider" },
        { key: "Enter", label: "Select & Next" },
        { key: "↓", label: "Focus Actions" },
      ];
    case "api-key":
      return [
        { key: "↑/↓", label: "Navigate Fields" },
        { key: "Space", label: "Select Method" },
        { key: "Enter", label: "Select & Next" },
        { key: "↓", label: "Focus Actions" },
      ];
    case "model":
      return [
        { key: "↑/↓", label: "Navigate Models" },
        { key: "Space", label: "Select Model" },
        { key: "Enter", label: "Select & Next" },
        { key: "↓", label: "Focus Actions" },
      ];
    case "analysis":
      return [
        { key: "↑/↓", label: "Navigate" },
        { key: "Space", label: "Toggle Option" },
        { key: "Enter", label: "Toggle & Next" },
        { key: "↓", label: "Focus Actions" },
      ];
    case "execution":
      return [
        { key: "↑/↓", label: "Navigate Modes" },
        { key: "Space", label: "Select Mode" },
        { key: "Enter", label: "Select & Next" },
        { key: "↓", label: "Focus Actions" },
      ];
    default:
      return [];
  }
}

export function OnboardingWizard() {
  const navigate = useNavigate();
  const focusFallbackRef = useRef<HTMLDivElement>(null);
  const {
    currentStep,
    wizardData,
    steps,
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
    cleanupEarlySave,
  } = useOnboarding();

  // Clean up early-saved credentials if wizard is abandoned (unmount without completing)
  const cleanupRef = useRef(cleanupEarlySave);
  cleanupRef.current = cleanupEarlySave;
  useEffect(() => {
    return () => { void cleanupRef.current(); };
  }, []);

  const buttonCount = isFirstStep ? 1 : 2;
  const primaryButtonIndex = isFirstStep ? 0 : 1;
  const canActivatePrimary = isLastStep ? canProceed && !isSubmitting : canProceed;
  const disabledFooterActions = isFirstStep
    ? [!canActivatePrimary]
    : [isSubmitting, !canActivatePrimary];

  useScope("onboarding");

  const footer = useActionRowNavigation({
    enabled: true,
    actionCount: buttonCount,
    disabledActions: disabledFooterActions,
    disabledFocusFallbackRef: focusFallbackRef,
    allowInInput: true,
    onAction: (index) => {
      if (isFirstStep) {
        handlePrimaryAction();
        return;
      }
      if (index === 0) {
        handleBack();
        return;
      }
      handlePrimaryAction();
    },
  });

  const handleNext = () => {
    next();
    footer.reset();
  };

  const handleBack = () => {
    back();
    footer.reset();
  };

  const handleComplete = async () => {
    try {
      await complete();
      navigate({ to: "/" });
    } catch {
      // Error already displayed by useOnboarding's error state
    }
  };

  const handlePrimaryAction = () => {
    if (!canActivatePrimary) return;
    if (isLastStep) {
      void handleComplete();
    } else {
      handleNext();
    }
  };

  usePageFooter({
    shortcuts: getStepShortcuts(
      currentStep,
      footer.inActions,
      footer.isFocusedActionDisabled,
    ),
  });

  const handleStepBoundary = (direction: "up" | "down") => {
    if (direction !== "down") return;
    footer.enterActions();
  };

  const handleStepCommit = (partial: Partial<WizardData> = {}) => {
    const projectedData = { ...wizardData, ...partial };
    if (!canProceedForStep(currentStep, projectedData)) return;

    if (isLastStep) {
      footer.enterActions(primaryButtonIndex);
      return;
    }

    handleNext();
  };

  const renderStep = () => {
    switch (currentStep) {
      case "storage":
        return (
          <StorageStep
            value={wizardData.secretsStorage}
            onChange={(secretsStorage) => updateData({ secretsStorage })}
            onCommit={(secretsStorage) => handleStepCommit({ secretsStorage })}
            keyboardNavigation={!footer.inActions}
            onBoundaryReached={handleStepBoundary}
          />
        );
      case "provider":
        return (
          <ProviderStep
            value={wizardData.provider}
            onChange={setProvider}
            onCommit={(provider) => handleStepCommit({ provider })}
            enabled={!footer.inActions}
            onBoundaryReached={handleStepBoundary}
          />
        );
      case "api-key":
        return wizardData.provider ? (
          <ApiKeyStep
            provider={wizardData.provider}
            value={wizardData.inputMethod}
            onChange={(inputMethod) => updateData({ inputMethod })}
            keyValue={wizardData.apiKey}
            onKeyValueChange={(apiKey) => updateData({ apiKey })}
            onCommit={(payload) => handleStepCommit(payload)}
            enabled={!footer.inActions}
            onBoundaryReached={handleStepBoundary}
          />
        ) : null;
      case "model":
        return wizardData.provider ? (
          <ModelStep
            provider={wizardData.provider}
            value={wizardData.model}
            onChange={(model) => updateData({ model })}
            onCommit={(model) => handleStepCommit({ model })}
            enabled={!footer.inActions}
            onBoundaryReached={handleStepBoundary}
          />
        ) : null;
      case "analysis":
        return (
          <AnalysisStep
            lenses={wizardData.defaultLenses}
            onLensesChange={(defaultLenses) => updateData({ defaultLenses })}
            onCommit={(payload) => handleStepCommit(payload)}
            enabled={!footer.inActions}
            onBoundaryReached={handleStepBoundary}
          />
        );
      case "execution":
        return (
          <ExecutionStep
            value={wizardData.agentExecution}
            onChange={(agentExecution: AgentExecution) => updateData({ agentExecution })}
            onCommit={(agentExecution) => handleStepCommit({ agentExecution })}
            enabled={!footer.inActions}
            onBoundaryReached={handleStepBoundary}
          />
        );
    }
  };

  return (
    <CardLayout
      title={STEP_TITLES[currentStep]}
      subtitle="Diffgazer Setup Wizard"
      footer={
        <>
          {!isFirstStep && (
            <Button
              {...footer.getActionProps(0)}
              variant="secondary"
              size="sm"
              onClick={handleBack}
              disabled={isSubmitting}
              className={cn(footer.inActions && footer.focusedIndex === 0 && !isSubmitting && "ring-2 ring-tui-blue")}
            >
              Back
            </Button>
          )}
          {isLastStep ? (
            <Button
              {...footer.getActionProps(primaryButtonIndex)}
              variant="success"
              size="sm"
              onClick={handlePrimaryAction}
              disabled={!canActivatePrimary}
              className={cn(footer.inActions && footer.focusedIndex === primaryButtonIndex && canActivatePrimary && "ring-2 ring-tui-blue")}
            >
              {isSubmitting ? "Saving..." : "Complete Setup"}
            </Button>
          ) : (
            <Button
              {...footer.getActionProps(primaryButtonIndex)}
              size="sm"
              onClick={handlePrimaryAction}
              disabled={!canActivatePrimary}
              className={cn(footer.inActions && footer.focusedIndex === primaryButtonIndex && canActivatePrimary && "ring-2 ring-tui-blue")}
            >
              Next
            </Button>
          )}
        </>
      }
    >
      <div ref={focusFallbackRef} tabIndex={-1} className="space-y-4 focus:outline-none">
        <HorizontalStepper steps={steps} value={currentStep} aria-label="Setup progress">
          {steps.map((step) => (
            <HorizontalStepper.Step key={step} value={step}>
              {STEP_LABELS[step]}
            </HorizontalStepper.Step>
          ))}
        </HorizontalStepper>
        {error && (
          <Callout tone="error" live>
            <Callout.Content>{error}</Callout.Content>
          </Callout>
        )}
        {renderStep()}
      </div>
    </CardLayout>
  );
}
