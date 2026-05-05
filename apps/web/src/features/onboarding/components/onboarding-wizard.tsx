import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CardLayout } from "@/components/ui/card-layout";
import { Button } from "@diffgazer/ui/components/button";
import { Callout } from "@diffgazer/ui/components/callout";
import { cn } from "@diffgazer/core/cn";
import type { Shortcut } from "@diffgazer/core/schemas/ui";
import { usePageFooter } from "@/hooks/use-page-footer";
import { useFooterNavigation } from "@/hooks/use-footer-navigation.js";
import { useScope } from "@diffgazer/keys";
import { useOnboarding } from "../hooks/use-onboarding";
import { WizardProgress } from "./wizard-progress";
import { StorageStep } from "./steps/storage-step";
import { ProviderStep } from "./steps/provider-step";
import { ApiKeyStep } from "./steps/api-key-step";
import { ModelStep } from "./steps/model-step";
import { AnalysisStep } from "./steps/analysis-step";
import { ExecutionStep } from "./steps/execution-step";
import type { AgentExecution } from "@diffgazer/core/schemas/config";
import { canProceed as canProceedForStep } from "../types.js";
import type { WizardData } from "../types";

const STEP_TITLES: Record<string, string> = {
  storage: "Secrets Storage",
  provider: "AI Provider",
  "api-key": "API Key",
  model: "Model Selection",
  analysis: "Analysis Configuration",
  execution: "Agent Execution",
};

function getStepShortcuts(currentStep: string, isButtonsZone: boolean): Shortcut[] {
  if (isButtonsZone) {
    return [
      { key: "←/→", label: "Move Action" },
      { key: "Enter/Space", label: "Activate Action" },
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
  } = useOnboarding();

  const buttonCount = isFirstStep ? 1 : 2;
  const primaryButtonIndex = isFirstStep ? 0 : 1;
  const canActivatePrimary = isLastStep ? canProceed && !isSubmitting : canProceed;

  const handleComplete = async () => {
    try {
      await complete();
      navigate({ to: "/" });
    } catch {
      // Hook sets error state for display; navigation skipped on failure
    }
  };

  const handlePrimaryAction = () => {
    if (!canActivatePrimary) return;
    if (isLastStep) {
      void handleComplete();
    } else {
      next();
    }
  };

  const footer = useFooterNavigation({
    enabled: true,
    buttonCount,
    allowInInput: true,
    onAction: (index) => {
      if (isFirstStep) {
        handlePrimaryAction();
        return;
      }
      if (index === 0) {
        back();
        return;
      }
      handlePrimaryAction();
    },
  });

  useEffect(() => {
    footer.reset();
  }, [currentStep]);

  useScope("onboarding");

  usePageFooter({
    shortcuts: getStepShortcuts(currentStep, footer.inFooter),
  });

  const handleStepBoundary = (direction: "up" | "down") => {
    if (direction !== "down") return;
    footer.enterFooter();
  };

  const handleStepCommit = (partial: Partial<WizardData> = {}) => {
    const projectedData = { ...wizardData, ...partial };
    if (!canProceedForStep(currentStep, projectedData)) return;

    if (isLastStep) {
      footer.enterFooter(primaryButtonIndex);
      return;
    }

    next();
  };

  const renderStep = () => {
    switch (currentStep) {
      case "storage":
        return (
          <StorageStep
            value={wizardData.secretsStorage}
            onChange={(secretsStorage) => updateData({ secretsStorage })}
            onCommit={(secretsStorage) => handleStepCommit({ secretsStorage })}
            enabled={!footer.inFooter}
            onBoundaryReached={handleStepBoundary}
          />
        );
      case "provider":
        return (
          <ProviderStep
            value={wizardData.provider}
            onChange={setProvider}
            onCommit={(provider) => handleStepCommit({ provider })}
            enabled={!footer.inFooter}
            onBoundaryReached={handleStepBoundary}
          />
        );
      case "api-key":
        return wizardData.provider ? (
          <ApiKeyStep
            provider={wizardData.provider}
            method={wizardData.inputMethod}
            onMethodChange={(inputMethod) => updateData({ inputMethod })}
            keyValue={wizardData.apiKey}
            onKeyValueChange={(apiKey) => updateData({ apiKey })}
            onCommit={(payload) => handleStepCommit(payload)}
            enabled={!footer.inFooter}
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
            enabled={!footer.inFooter}
            onBoundaryReached={handleStepBoundary}
          />
        ) : null;
      case "analysis":
        return (
          <AnalysisStep
            lenses={wizardData.defaultLenses}
            onLensesChange={(defaultLenses) => updateData({ defaultLenses })}
            onCommit={(payload) => handleStepCommit(payload)}
            enabled={!footer.inFooter}
            onBoundaryReached={handleStepBoundary}
          />
        );
      case "execution":
        return (
          <ExecutionStep
            value={wizardData.agentExecution}
            onChange={(agentExecution: AgentExecution) => updateData({ agentExecution })}
            onCommit={(agentExecution) => handleStepCommit({ agentExecution })}
            enabled={!footer.inFooter}
            onBoundaryReached={handleStepBoundary}
          />
        );
    }
  };

  return (
    <CardLayout
      title={STEP_TITLES[currentStep] ?? "Setup"}
      subtitle="Diffgazer Setup Wizard"
      footer={
        <>
          {!isFirstStep && (
            <Button
              variant="secondary"
              size="sm"
              onClick={back}
              disabled={isSubmitting}
              className={cn(footer.inFooter && footer.focusedIndex === 0 && "ring-2 ring-tui-blue")}
            >
              Back
            </Button>
          )}
          {isLastStep ? (
            <Button
              variant="success"
              size="sm"
              onClick={handlePrimaryAction}
              disabled={!canProceed || isSubmitting}
              className={cn(footer.inFooter && footer.focusedIndex === primaryButtonIndex && "ring-2 ring-tui-blue")}
            >
              {isSubmitting ? "Saving..." : "Complete Setup"}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handlePrimaryAction}
              disabled={!canProceed}
              className={cn(footer.inFooter && footer.focusedIndex === primaryButtonIndex && "ring-2 ring-tui-blue")}
            >
              Next
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <WizardProgress steps={steps} currentStep={currentStep} />
        {error && (
          <Callout variant="error">
            {error}
          </Callout>
        )}
        {renderStep()}
      </div>
    </CardLayout>
  );
}
