import { usePageFooter } from "@diffgazer/core/footer";
import {
  canProceed as canProceedForStep,
  getOnboardingProgressLabel,
  type OnboardingDraft,
  type OnboardingStep,
} from "@diffgazer/core/onboarding";
import { useActionRowNavigation, useKey, useScope } from "@diffgazer/keys";
import { useNavigate } from "@tanstack/react-router";
import type { RefObject } from "react";
import { getStepShortcuts } from "../lib/shortcuts";

type WizardDraftUpdate = Partial<Omit<OnboardingDraft, "kind" | "plan">>;

interface UseOnboardingKeyboardOptions {
  currentStep: OnboardingStep;
  wizardData: OnboardingDraft;
  stepIndex: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  canProceed: boolean;
  isSubmitting: boolean;
  isReconciling: boolean;
  isPreparingDraftConfiguration: boolean;
  next: (partial?: WizardDraftUpdate) => void;
  back: () => void;
  complete: () => Promise<boolean>;
  focusFallbackRef: RefObject<HTMLDivElement | null>;
}

export function useOnboardingKeyboard({
  currentStep,
  wizardData,
  stepIndex,
  isFirstStep,
  isLastStep,
  canProceed,
  isSubmitting,
  isReconciling,
  isPreparingDraftConfiguration,
  next,
  back,
  complete,
  focusFallbackRef,
}: UseOnboardingKeyboardOptions) {
  const navigate = useNavigate();

  const buttonCount = isFirstStep ? 1 : 2;
  const primaryButtonIndex = isFirstStep ? 0 : 1;
  const isBusy = isSubmitting || isReconciling || isPreparingDraftConfiguration;
  const canActivatePrimary = isLastStep
    ? canProceed && !isBusy
    : canProceed && !isReconciling && !isPreparingDraftConfiguration;
  const disabledFooterActions = isFirstStep ? [!canActivatePrimary] : [isBusy, !canActivatePrimary];

  useScope("onboarding");

  const footer = useActionRowNavigation({
    enabled: true,
    actionCount: buttonCount,
    disabledActions: disabledFooterActions,
    disabledFocusFallbackRef: focusFallbackRef,
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

  const handleNext = (partial?: WizardDraftUpdate) => {
    next(partial);
    footer.reset();
  };

  const handleBack = () => {
    back();
    footer.reset();
  };

  const handleComplete = async () => {
    if (await complete()) navigate({ to: "/" });
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
    shortcuts: getStepShortcuts(currentStep, footer.inActions, footer.isFocusedActionDisabled),
  });

  const focusFooterActions = () => {
    footer.enterActions(primaryButtonIndex);
  };

  const handleStepBoundary = (direction: "up" | "down") => {
    if (direction !== "down") return;
    focusFooterActions();
  };

  // ArrowDown from editable fields must reach the footer without re-enabling
  // allowInInput on the whole action row (that would hijack L/R/Up in inputs).
  useKey("ArrowDown", focusFooterActions, {
    enabled: !footer.inActions,
    allowInInput: true,
    preventDefault: true,
  });

  const handleStepCommit = (partial: WizardDraftUpdate = {}) => {
    const projectedData = { ...wizardData, ...partial };
    if (!canProceedForStep(currentStep, projectedData)) return;

    if (isLastStep) {
      footer.enterActions(primaryButtonIndex);
      return;
    }

    handleNext(partial);
  };

  const progressLabel = getOnboardingProgressLabel(wizardData.plan, stepIndex);

  return {
    footer,
    primaryButtonIndex,
    progressLabel,
    isBusy,
    canActivatePrimary,
    handleBack,
    handlePrimaryAction,
    handleStepBoundary,
    handleStepCommit,
  };
}
