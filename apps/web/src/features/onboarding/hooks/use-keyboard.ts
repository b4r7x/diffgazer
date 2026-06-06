import { usePageFooter } from "@diffgazer/core/footer";
import {
  canProceed as canProceedForStep,
  type OnboardingStep,
  type WizardData,
} from "@diffgazer/core/onboarding";
import { useActionRowNavigation, useScope } from "@diffgazer/keys";
import { useNavigate } from "@tanstack/react-router";
import type { RefObject } from "react";
import { getStepShortcuts } from "../shortcuts";

interface UseOnboardingKeyboardOptions {
  currentStep: OnboardingStep;
  wizardData: WizardData;
  isFirstStep: boolean;
  isLastStep: boolean;
  canProceed: boolean;
  isSubmitting: boolean;
  isEarlySaving: boolean;
  next: () => void;
  back: () => void;
  complete: () => Promise<void>;
  focusFallbackRef: RefObject<HTMLDivElement | null>;
}

export function useOnboardingKeyboard({
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
}: UseOnboardingKeyboardOptions) {
  const navigate = useNavigate();

  const buttonCount = isFirstStep ? 1 : 2;
  const primaryButtonIndex = isFirstStep ? 0 : 1;
  const isBusy = isSubmitting || isEarlySaving;
  const canActivatePrimary = isLastStep ? canProceed && !isBusy : canProceed && !isEarlySaving;
  const disabledFooterActions = isFirstStep ? [!canActivatePrimary] : [isBusy, !canActivatePrimary];

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
    shortcuts: getStepShortcuts(currentStep, footer.inActions, footer.isFocusedActionDisabled),
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

  return {
    footer,
    primaryButtonIndex,
    isBusy,
    canActivatePrimary,
    handleBack,
    handlePrimaryAction,
    handleStepBoundary,
    handleStepCommit,
  };
}
