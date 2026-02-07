import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { WizardLayout } from "@/components/shared/wizard-layout";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { useConfigData } from "@/app/providers/config-provider";
import { useOnboarding } from "../hooks/use-onboarding";
import { WizardProgress } from "./wizard-progress";
import { StorageStep } from "./steps/storage-step";
import { ProviderStep } from "./steps/provider-step";
import { ApiKeyStep } from "./steps/api-key-step";
import { ModelStep } from "./steps/model-step";
import { AnalysisStep } from "./steps/analysis-step";
import type { AgentExecution } from "@stargazer/schemas/config";

const STEP_TITLES: Record<string, string> = {
  storage: "Secrets Storage",
  provider: "AI Provider",
  "api-key": "API Key",
  model: "Model Selection",
  analysis: "Analysis Configuration",
};

export function OnboardingWizard() {
  const navigate = useNavigate();
  const { isConfigured } = useConfigData();
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
    if (isConfigured) {
      navigate({ to: "/", replace: true });
    }
  }, [isConfigured, navigate]);

  if (isConfigured) return null;

  const handleComplete = async () => {
    try {
      await complete();
      navigate({ to: "/" });
    } catch (e) {
      // Hook sets error state for display; navigation skipped on failure
      console.error("Onboarding completion failed:", e);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case "storage":
        return (
          <StorageStep
            value={wizardData.secretsStorage}
            onChange={(secretsStorage) => updateData({ secretsStorage })}
          />
        );
      case "provider":
        return (
          <ProviderStep
            value={wizardData.provider}
            onChange={setProvider}
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
          />
        ) : null;
      case "model":
        return wizardData.provider ? (
          <ModelStep
            provider={wizardData.provider}
            value={wizardData.model}
            onChange={(model) => updateData({ model })}
          />
        ) : null;
      case "analysis":
        return (
          <AnalysisStep
            lenses={wizardData.defaultLenses}
            onLensesChange={(defaultLenses) => updateData({ defaultLenses })}
            agentExecution={wizardData.agentExecution}
            onAgentExecutionChange={(agentExecution: AgentExecution) => updateData({ agentExecution })}
          />
        );
    }
  };

  return (
    <WizardLayout
      title={STEP_TITLES[currentStep] ?? "Setup"}
      subtitle="Stargazer Setup Wizard"
      footer={
        <>
          {!isFirstStep && (
            <Button variant="secondary" size="sm" onClick={back} disabled={isSubmitting}>
              Back
            </Button>
          )}
          {isLastStep ? (
            <Button
              variant="success"
              size="sm"
              onClick={handleComplete}
              disabled={!canProceed || isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Complete Setup"}
            </Button>
          ) : (
            <Button size="sm" onClick={next} disabled={!canProceed}>
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
    </WizardLayout>
  );
}
