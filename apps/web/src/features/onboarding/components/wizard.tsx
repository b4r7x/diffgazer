import type { OnboardingStep } from "@diffgazer/core/onboarding";
import { getPlanNotice, STEP_LABELS, STEP_TITLES } from "@diffgazer/core/onboarding";
import { acceptNotice, PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { PROVIDER_CONSENT_TEXT } from "@diffgazer/core/schemas/config";
import { Button } from "@diffgazer/ui/components/button";
import { Callout } from "@diffgazer/ui/components/callout";
import { Checkbox } from "@diffgazer/ui/components/checkbox";
import { HorizontalStepper } from "@diffgazer/ui/components/horizontal-stepper";
import { useEffect, useRef } from "react";
import { CardLayout } from "@/components/layout/card";
import { useOnboardingKeyboard } from "../hooks/use-keyboard";
import { useOnboarding } from "../hooks/use-onboarding";
import { ApiKeyStep } from "./steps/api-key-step";
import { EndpointStep } from "./steps/endpoint-step";
import { ModelStep } from "./steps/model-step";
import { ProviderStep } from "./steps/provider-step";

function getPrimaryLabel(isLastStep: boolean, isBusy: boolean): string {
  if (!isLastStep) return "Next";
  return isBusy ? "Saving..." : "Complete Setup";
}

export function OnboardingWizard() {
  const focusFallbackRef = useRef<HTMLDivElement>(null);
  const stepCheckboxRef = useRef<HTMLDivElement>(null);
  const {
    currentStep,
    wizardData,
    steps,
    stepIndex,
    isFirstStep,
    isLastStep,
    canProceed,
    isReconciling,
    isSubmitting,
    error,
    draftConfiguration,
    isPreparingDraftConfiguration,
    prepareDraftConfiguration,
    next,
    back,
    updateData,
    setProduct,
    complete,
  } = useOnboarding();

  const notice = getPlanNotice(wizardData.plan);

  // The model step reads models back from a persisted record, so the draft
  // tuple is committed as the user arrives rather than invented client-side.
  const enterStep = (step: OnboardingStep | undefined) => {
    if (step === "model") void prepareDraftConfiguration();
  };

  const {
    footer,
    primaryButtonIndex,
    progressLabel,
    isBusy,
    canActivatePrimary,
    handleBack,
    handlePrimaryAction,
    handleStepBoundary,
    handleStepCommit,
  } = useOnboardingKeyboard({
    currentStep,
    wizardData,
    stepIndex,
    isFirstStep,
    isLastStep,
    canProceed,
    isSubmitting,
    isReconciling,
    isPreparingDraftConfiguration,
    next: (partial) => {
      next(partial);
      enterStep(steps[stepIndex + 1]);
    },
    back: () => {
      back();
      enterStep(steps[stepIndex - 1]);
    },
    complete,
    focusFallbackRef,
  });

  // The radio steps focus their selected item through RadioGroup autoFocus;
  // the notice checkbox has no self-focusing group, so step entry places focus
  // on it here or arrows would only reach the footer. Keyed on the footer zone
  // too, so ArrowUp out of the actions lands back on the checkbox instead of
  // the invisible fallback div.
  // biome-ignore lint/correctness/useExhaustiveDependencies: currentStep is never read in the body; it is the intentional re-trigger above.
  useEffect(() => {
    if (footer.inActions) return;
    stepCheckboxRef.current?.focus();
  }, [currentStep, footer.inActions]);

  const renderRunnableStep = () => {
    const { configurationInput, selectedModelId, acknowledgement, plan } = wizardData;

    switch (currentStep) {
      case "product":
        return (
          <ProviderStep
            value={plan.productId}
            onChange={setProduct}
            onCommit={() => handleStepCommit()}
            enabled={!footer.inActions}
            onBoundaryReached={handleStepBoundary}
          />
        );
      case "endpoint-binding":
        return (
          <EndpointStep
            productId={plan.productId}
            value={configurationInput}
            onChange={(next) => updateData({ configurationInput: next })}
            onCommit={() => handleStepCommit()}
            enabled={!footer.inActions}
            onBoundaryReached={handleStepBoundary}
          />
        );
      case "authentication":
        return (
          <ApiKeyStep
            configurationInput={configurationInput}
            onChange={(nextInput) => updateData({ configurationInput: nextInput })}
            onCommit={() => handleStepCommit()}
            enabled={!footer.inActions}
            onBoundaryReached={handleStepBoundary}
          />
        );
      case "model":
        return (
          <ModelStep
            configuration={draftConfiguration}
            isPreparing={isPreparingDraftConfiguration}
            onRetry={() => void prepareDraftConfiguration()}
            value={selectedModelId}
            onChange={(model) => updateData({ selectedModelId: model })}
            onCommit={(model) => handleStepCommit({ selectedModelId: model })}
            enabled={!footer.inActions}
            onBoundaryReached={handleStepBoundary}
          />
        );
      case "acknowledgement": {
        const accepted =
          acknowledgement.status === "accepted" &&
          acknowledgement.noticeId === notice.id &&
          acknowledgement.noticeVersion === notice.noticeVersion;
        return (
          <div className="space-y-4">
            <p className="text-sm font-mono">{PROVIDER_CONSENT_TEXT}</p>
            <div className="space-y-2 text-xs font-mono text-muted-foreground">
              <p>{PRODUCT_REGISTRY[plan.productId].presentation.name} notice:</p>
              {notice.billing.map((line) => (
                <p key={line}>{line}</p>
              ))}
              {notice.privacy.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <Checkbox
              ref={stepCheckboxRef}
              checked={accepted}
              onChange={(checked) =>
                updateData({
                  acknowledgement: checked ? acceptNotice(notice) : { status: "required" },
                })
              }
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                handleStepCommit();
              }}
              label="I accept"
            />
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <CardLayout
      title={STEP_TITLES[currentStep]}
      readout="Setup"
      contentInactive={footer.inActions}
      footer={
        <>
          {!isFirstStep && (
            <Button
              {...footer.getActionProps(0)}
              variant="secondary"
              size="sm"
              bracket
              highlighted={footer.inActions && footer.focusedIndex === 0 && !isBusy}
              onClick={handleBack}
              disabled={isBusy}
            >
              Back
            </Button>
          )}
          <Button
            {...footer.getActionProps(primaryButtonIndex)}
            size="sm"
            bracket
            highlighted={
              footer.inActions && footer.focusedIndex === primaryButtonIndex && canActivatePrimary
            }
            onClick={handlePrimaryAction}
            disabled={!canActivatePrimary}
          >
            {getPrimaryLabel(isLastStep, isBusy)}
          </Button>
        </>
      }
    >
      <div ref={focusFallbackRef} tabIndex={-1} className="space-y-4 focus:outline-none">
        <HorizontalStepper compact value={currentStep} aria-label="Setup progress">
          {steps.map((step) => (
            <HorizontalStepper.Step key={step} value={step}>
              {STEP_LABELS[step]}
            </HorizontalStepper.Step>
          ))}
        </HorizontalStepper>
        <p className="text-xs text-muted-foreground font-mono">{progressLabel}</p>
        {error ? (
          <Callout tone="error" live>
            <Callout.Content>{error}</Callout.Content>
          </Callout>
        ) : null}
        {renderRunnableStep()}
      </div>
    </CardLayout>
  );
}
