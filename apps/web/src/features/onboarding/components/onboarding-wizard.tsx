import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CardLayout, Button, Callout } from "@diffgazer/ui";
import type { Shortcut } from "@diffgazer/schemas/ui";
import { usePageFooter } from "@/hooks/use-page-footer";
import { useKey, useScope } from "@diffgazer/keyboard";
import { cn } from "@/utils/cn";
import { useOnboarding } from "../hooks/use-onboarding";
import { WizardProgress } from "./wizard-progress";
import { StorageStep } from "./steps/storage-step";
import { ProviderStep } from "./steps/provider-step";
import { ApiKeyStep } from "./steps/api-key-step";
import { ModelStep } from "./steps/model-step";
import { AnalysisStep } from "./steps/analysis-step";
import { ExecutionStep } from "./steps/execution-step";
import type { AgentExecution } from "@diffgazer/schemas/config";
import type { WizardData } from "../types";

const STEP_TITLES: Record<string, string> = {
  storage: "Secrets Storage",
  provider: "AI Provider",
  "api-key": "API Key",
  model: "Model Selection",
  analysis: "Analysis Configuration",
  execution: "Agent Execution",
};

type FocusZone = "content" | "buttons";

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

function canProceedForStep(step: string, data: WizardData): boolean {
  switch (step) {
    case "storage":
      return true;
    case "provider":
      return data.provider !== null;
    case "api-key":
      return data.inputMethod === "env" || data.apiKey.length > 0;
    case "model":
      return data.model !== null;
    case "analysis":
      return data.defaultLenses.length > 0;
    case "execution":
      return true;
    default:
      return false;
  }
}

export function OnboardingWizard() {
  const navigate = useNavigate();
  const [focusZone, setFocusZone] = useState<FocusZone>("content");
  const [buttonIndex, setButtonIndex] = useState(0);
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

  useEffect(() => {
    setFocusZone("content");
    setButtonIndex(0);
  }, [currentStep]);

  useScope("onboarding");

  const isButtonsZone = focusZone === "buttons";
  const buttonCount = isFirstStep ? 1 : 2;
  const primaryButtonIndex = isFirstStep ? 0 : 1;
  const canActivatePrimary = isLastStep ? canProceed && !isSubmitting : canProceed;

  usePageFooter({
    shortcuts: getStepShortcuts(currentStep, isButtonsZone),
  });

  const handleComplete = async () => {
    try {
      await complete();
      navigate({ to: "/" });
    } catch (e) {
      // Hook sets error state for display; navigation skipped on failure
      console.error("Onboarding completion failed:", e);
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

  const activateButton = () => {
    if (isFirstStep) {
      handlePrimaryAction();
      return;
    }

    if (buttonIndex === 0) {
      back();
      return;
    }

    handlePrimaryAction();
  };

  useKey("ArrowUp", () => {
    setFocusZone("content");
    setButtonIndex(0);
  }, { enabled: isButtonsZone, allowInInput: true });

  useKey("ArrowDown", () => {}, { enabled: isButtonsZone, allowInInput: true });

  useKey("ArrowLeft", () => {
    if (buttonCount <= 1) return;
    setButtonIndex((index) => Math.max(0, index - 1));
  }, { enabled: isButtonsZone, allowInInput: true });

  useKey("ArrowRight", () => {
    if (buttonCount <= 1) return;
    setButtonIndex((index) => Math.min(buttonCount - 1, index + 1));
  }, { enabled: isButtonsZone, allowInInput: true });

  useKey("Enter", activateButton, { enabled: isButtonsZone, allowInInput: true });
  useKey(" ", activateButton, { enabled: isButtonsZone, allowInInput: true });

  const handleStepBoundary = (direction: "up" | "down") => {
    if (direction !== "down") return;
    setFocusZone("buttons");
    setButtonIndex(0);
  };

  const handleStepCommit = (partial: Partial<WizardData> = {}) => {
    const projectedData = { ...wizardData, ...partial };
    if (!canProceedForStep(currentStep, projectedData)) return;

    if (isLastStep) {
      setFocusZone("buttons");
      setButtonIndex(primaryButtonIndex);
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
            enabled={!isButtonsZone}
            onBoundaryReached={handleStepBoundary}
          />
        );
      case "provider":
        return (
          <ProviderStep
            value={wizardData.provider}
            onChange={setProvider}
            onCommit={(provider) => handleStepCommit({ provider })}
            enabled={!isButtonsZone}
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
            enabled={!isButtonsZone}
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
            enabled={!isButtonsZone}
            onBoundaryReached={handleStepBoundary}
          />
        ) : null;
      case "analysis":
        return (
          <AnalysisStep
            lenses={wizardData.defaultLenses}
            onLensesChange={(defaultLenses) => updateData({ defaultLenses })}
            onCommit={(payload) => handleStepCommit(payload)}
            enabled={!isButtonsZone}
            onBoundaryReached={handleStepBoundary}
          />
        );
      case "execution":
        return (
          <ExecutionStep
            value={wizardData.agentExecution}
            onChange={(agentExecution: AgentExecution) => updateData({ agentExecution })}
            onCommit={(agentExecution) => handleStepCommit({ agentExecution })}
            enabled={!isButtonsZone}
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
              className={cn(isButtonsZone && buttonIndex === 0 && "ring-2 ring-tui-blue")}
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
              className={cn(isButtonsZone && buttonIndex === primaryButtonIndex && "ring-2 ring-tui-blue")}
            >
              {isSubmitting ? "Saving..." : "Complete Setup"}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handlePrimaryAction}
              disabled={!canProceed}
              className={cn(isButtonsZone && buttonIndex === primaryButtonIndex && "ring-2 ring-tui-blue")}
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
