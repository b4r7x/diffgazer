import type { OnboardingConfigurationDraft, OnboardingStep } from "@diffgazer/core/onboarding";
import { STEP_LABELS, STEP_TITLES } from "@diffgazer/core/onboarding";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { REMOVED_PRODUCT_ID } from "@diffgazer/core/schemas/config";
import { Button } from "@diffgazer/ui/components/button";
import { Callout } from "@diffgazer/ui/components/callout";
import { Checkbox } from "@diffgazer/ui/components/checkbox";
import { Field } from "@diffgazer/ui/components/field";
import { HorizontalStepper } from "@diffgazer/ui/components/horizontal-stepper";
import { InputGroup } from "@diffgazer/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { useEffect, useRef } from "react";
import { CardLayout } from "@/components/layout/card";
import { useConfigData } from "@/hooks/use-config";
import { useOnboardingKeyboard } from "../hooks/use-keyboard";
import { useOnboarding } from "../hooks/use-onboarding";
import { ApiKeyStep } from "./steps/api-key-step";
import { ModelStep } from "./steps/model-step";
import { ProviderStep } from "./steps/provider-step";

function getPrimaryLabel(isLastStep: boolean, isBusy: boolean, primaryLabel: string): string {
  if (!isLastStep) return "Next";
  return isBusy ? "Saving..." : primaryLabel;
}

export function OnboardingWizard() {
  const focusFallbackRef = useRef<HTMLDivElement>(null);
  const stepCheckboxRef = useRef<HTMLDivElement>(null);
  const { configurations } = useConfigData();
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
    deleteRemovedConfiguration,
  } = useOnboarding();

  const removedRecord = configurations.find(
    ({ configuration }) => configuration.status === "removed",
  );

  // The model step reads models back from a persisted record, so the draft
  // tuple is committed as the user arrives rather than invented client-side.
  const enterStep = (step: OnboardingStep | undefined) => {
    if (step === "model") void prepareDraftConfiguration();
  };

  const {
    footer,
    primaryButtonIndex,
    primaryLabel,
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
    planSteps: wizardData.plan.steps,
    isFirstStep,
    isLastStep,
    canProceed,
    isSubmitting,
    isReconciling,
    next: (partial) => {
      next(partial);
      enterStep(steps[stepIndex + 1]);
    },
    back: () => {
      back();
      enterStep(steps[stepIndex - 1]);
    },
    complete,
    deleteRemovedConfiguration,
    focusFallbackRef,
  });

  // The radio steps focus their selected item through RadioGroup autoFocus;
  // the checkbox steps have no self-focusing group, so step entry places focus
  // on the checkbox here or arrows would only reach the footer. The removed
  // flow renders prose only, so its steps park entry focus on the content
  // wrapper to keep the ArrowDown-to-actions path alive. The step components key
  // entry focus on their own active flag; this one keys on the step, the only
  // input that changes between the two checkbox steps.
  const isRemovedFlow = wizardData.kind === "removed";
  // biome-ignore lint/correctness/useExhaustiveDependencies: currentStep is never read in the body; it is the intentional re-trigger above. Dropping it stops entry focus from re-placing on conformance -> acknowledgement, where neither isRemovedFlow nor the refs change.
  useEffect(() => {
    if (stepCheckboxRef.current) {
      stepCheckboxRef.current.focus();
      return;
    }
    if (isRemovedFlow) focusFallbackRef.current?.focus();
  }, [currentStep, isRemovedFlow]);

  const renderRunnableStep = () => {
    if (wizardData.kind !== "runnable") return null;
    const { configurationInput, selectedModelId, conformanceStatus, acknowledgement, plan } =
      wizardData;

    switch (currentStep) {
      case "product":
        return (
          <ProviderStep
            value={plan.productId}
            removedRecord={
              removedRecord?.configuration.productId === REMOVED_PRODUCT_ID
                ? {
                    name: PRODUCT_REGISTRY[REMOVED_PRODUCT_ID].presentation.name,
                    description: PRODUCT_REGISTRY[REMOVED_PRODUCT_ID].presentation.description,
                    replacementName: PRODUCT_REGISTRY.zai.presentation.name,
                  }
                : null
            }
            onChange={setProduct}
            onCommit={() => handleStepCommit()}
            enabled={!footer.inActions}
            onBoundaryReached={handleStepBoundary}
          />
        );
      case "endpoint-binding": {
        const product = PRODUCT_REGISTRY[plan.productId];
        if (configurationInput.transportFamily === "hosted-api") {
          const workspaceRequired = product.configuration.endpoints.some(
            (endpoint) => "workspaceBound" in endpoint && endpoint.workspaceBound,
          );
          return (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground font-mono">
                Choose the endpoint tuple for {product.presentation.name}.
              </p>
              <RadioGroup
                aria-label="Endpoint profile"
                value={configurationInput.endpoint}
                onChange={(endpoint) => {
                  const profile = product.configuration.endpoints.find(
                    (candidate) => candidate.endpoint === endpoint,
                  );
                  if (!profile) return;
                  updateData({
                    configurationInput: {
                      ...configurationInput,
                      endpoint,
                      ...("region" in profile ? { region: profile.region } : {}),
                      workspace:
                        "workspaceBound" in profile && profile.workspaceBound
                          ? (configurationInput.workspace ?? "")
                          : undefined,
                    },
                  });
                }}
                onEnter={() => handleStepCommit()}
                autoFocus={!footer.inActions}
                keyboardNavigation={!footer.inActions}
                onNavigationBoundaryReached={() => handleStepBoundary("down")}
                className="space-y-1"
              >
                {product.configuration.endpoints.map((endpoint) => (
                  <RadioGroupItem
                    key={endpoint.id}
                    value={endpoint.endpoint}
                    label={endpoint.label}
                    description={endpoint.endpoint}
                  />
                ))}
              </RadioGroup>
              {workspaceRequired ? (
                <Field>
                  <Field.Label>Workspace reference</Field.Label>
                  <Field.Control>
                    <InputGroup
                      value={configurationInput.workspace ?? ""}
                      onChange={(event) =>
                        updateData({
                          configurationInput: {
                            ...configurationInput,
                            workspace: event.target.value,
                          },
                        })
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleStepCommit();
                        }
                      }}
                      aria-label="Workspace reference"
                    />
                  </Field.Control>
                </Field>
              ) : null}
            </div>
          );
        }

        if (configurationInput.transportFamily === "local-http") {
          return (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground font-mono">
                Configure the loopback endpoint for {product.presentation.name}.
              </p>
              <RadioGroup
                aria-label="Loopback endpoint"
                value={configurationInput.presetId ?? configurationInput.endpoint}
                onChange={(presetId) => {
                  const profile = product.configuration.endpoints.find(
                    (candidate) => candidate.id === presetId,
                  );
                  if (!profile || !("endpoint" in profile)) return;
                  const nextInput: OnboardingConfigurationDraft = {
                    ...configurationInput,
                    endpoint: profile.endpoint,
                  };
                  if (plan.productId === "local-openai") {
                    updateData({
                      configurationInput: {
                        ...nextInput,
                        presetId: profile.id as "lm-studio" | "llama-cpp",
                      },
                    });
                    return;
                  }
                  updateData({ configurationInput: nextInput });
                }}
                onEnter={() => handleStepCommit()}
                autoFocus={!footer.inActions}
                keyboardNavigation={!footer.inActions}
                className="space-y-1"
              >
                {product.configuration.endpoints.map((endpoint) => (
                  <RadioGroupItem
                    key={endpoint.id}
                    value={endpoint.id}
                    label={endpoint.label}
                    description={endpoint.endpoint}
                  />
                ))}
              </RadioGroup>
            </div>
          );
        }

        return (
          <p className="text-sm text-muted-foreground font-mono">
            {product.presentation.setupLabel} does not require endpoint binding.
          </p>
        );
      }
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
      case "conformance":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground font-mono">
              Confirm the configured transport tuple and exact model are ready for conformance
              verification.
            </p>
            <Checkbox
              ref={stepCheckboxRef}
              checked={conformanceStatus === "passed"}
              onChange={(checked) =>
                updateData({ conformanceStatus: checked ? "passed" : "not-tested" })
              }
              label="I verified the configuration tuple and exact model selection."
            />
          </div>
        );
      case "acknowledgement": {
        const notice = plan.steps.find((step) => step.id === "acknowledgement")?.notice;
        if (!notice) return null;
        const accepted =
          acknowledgement.status === "accepted" &&
          acknowledgement.noticeId === notice.id &&
          acknowledgement.noticeVersion === notice.noticeVersion;
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground font-mono">
              Review and explicitly accept the current product notice before completing setup.
            </p>
            <div className="space-y-2 text-xs font-mono">
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
                  acknowledgement: checked
                    ? {
                        status: "accepted",
                        noticeId: notice.id,
                        noticeVersion: notice.noticeVersion,
                        acceptedAt: new Date().toISOString(),
                      }
                    : { status: "required" },
                })
              }
              label="I accept the billing and privacy notice for this product."
            />
          </div>
        );
      }
      default:
        return null;
    }
  };

  const renderRemovedStep = () => {
    if (wizardData.kind !== "removed") return null;
    if (currentStep === "migration") {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground font-mono">
            Create a {PRODUCT_REGISTRY.zai.presentation.name} configuration to replace this removed
            record. Existing credentials stay server-side until you explicitly delete the removed
            record.
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground font-mono">
          Delete the removed {PRODUCT_REGISTRY[REMOVED_PRODUCT_ID].presentation.name} record after
          migration is complete.
        </p>
      </div>
    );
  };

  return (
    <CardLayout
      title={STEP_TITLES[currentStep]}
      readout="Setup"
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
            {getPrimaryLabel(isLastStep, isBusy, primaryLabel)}
          </Button>
        </>
      }
    >
      <div ref={focusFallbackRef} tabIndex={-1} className="space-y-4 focus:outline-none">
        <HorizontalStepper compact steps={steps} value={currentStep} aria-label="Setup progress">
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
        {wizardData.kind === "removed" ? renderRemovedStep() : renderRunnableStep()}
      </div>
    </CardLayout>
  );
}
