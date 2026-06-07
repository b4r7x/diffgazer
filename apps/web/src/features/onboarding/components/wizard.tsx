import type { AgentExecution } from "@diffgazer/core/schemas/config";
import { Button } from "@diffgazer/ui/components/button";
import { Callout } from "@diffgazer/ui/components/callout";
import { HorizontalStepper } from "@diffgazer/ui/components/horizontal-stepper";
import { cn } from "@diffgazer/ui/lib/utils";
import { useEffect, useEffectEvent, useRef } from "react";
import { CardLayout } from "@/components/ui/card-layout";
import { useOnboardingKeyboard } from "../hooks/use-keyboard";
import { useOnboarding } from "../hooks/use-onboarding";
import { STEP_LABELS, STEP_TITLES } from "../shortcuts";
import { AnalysisStep } from "./steps/analysis-step";
import { ApiKeyStep } from "./steps/api-key-step";
import { ExecutionStep } from "./steps/execution-step";
import { ModelStep } from "./steps/model-step";
import { ProviderStep } from "./steps/provider-step";
import { StorageStep } from "./steps/storage-step";

export function OnboardingWizard() {
  const focusFallbackRef = useRef<HTMLDivElement>(null);
  const {
    currentStep,
    wizardData,
    steps,
    isFirstStep,
    isLastStep,
    canProceed,
    isSubmitting,
    isEarlySaving,
    error,
    next,
    back,
    updateData,
    setProvider,
    complete,
    cleanupEarlySave,
  } = useOnboarding();

  // Clean up early-saved credentials if wizard is abandoned (unmount without completing)
  const runCleanup = useEffectEvent(() => {
    void cleanupEarlySave();
  });
  useEffect(() => {
    return () => runCleanup();
  }, []);

  const {
    footer,
    primaryButtonIndex,
    isBusy,
    canActivatePrimary,
    handleBack,
    handlePrimaryAction,
    handleStepBoundary,
    handleStepCommit,
  } = useOnboardingKeyboard({
    currentStep,
    wizardData,
    isFirstStep,
    isLastStep,
    canProceed,
    isSubmitting,
    isEarlySaving,
    next,
    back,
    complete,
    focusFallbackRef,
  });

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
              disabled={isBusy}
              className={cn(
                footer.inActions && footer.focusedIndex === 0 && !isBusy && "ring-2 ring-tui-blue",
              )}
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
              className={cn(
                footer.inActions &&
                  footer.focusedIndex === primaryButtonIndex &&
                  canActivatePrimary &&
                  "ring-2 ring-tui-blue",
              )}
            >
              {isBusy ? "Saving..." : "Complete Setup"}
            </Button>
          ) : (
            <Button
              {...footer.getActionProps(primaryButtonIndex)}
              size="sm"
              onClick={handlePrimaryAction}
              disabled={!canActivatePrimary}
              className={cn(
                footer.inActions &&
                  footer.focusedIndex === primaryButtonIndex &&
                  canActivatePrimary &&
                  "ring-2 ring-tui-blue",
              )}
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
