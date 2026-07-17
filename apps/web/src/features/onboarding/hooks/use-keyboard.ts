import { usePageFooter } from "@diffgazer/core/footer";
import {
  canProceed as canProceedForStep,
  type OnboardingStep,
  type WizardData,
} from "@diffgazer/core/onboarding";
import { useActionRowNavigation, useScope } from "@diffgazer/keys";
import { useNavigate } from "@tanstack/react-router";
import type { RefObject } from "react";
import { getStepShortcuts } from "../lib/shortcuts";

interface UseOnboardingKeyboardOptions {
  currentStep: OnboardingStep;
  wizardData: WizardData;
  isFirstStep: boolean;
  isLastStep: boolean;
  canProceed: boolean;
  isSubmitting: boolean;
  isEarlySaving: boolean;
  next: (partial?: Partial<WizardData>) => void;
  back: () => void;
  complete: () => Promise<boolean>;
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

  const handleNext = (partial?: Partial<WizardData>) => {
    next(partial);
    footer.reset();
  };

  const handleBack = () => {
    back();
    footer.reset();
  };

  const handleComplete = async () => {
    // complete() reports failures through the wizard error state; only navigate on success.
    if (await complete()) {
      navigate({ to: "/" });
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

    handleNext(partial);
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
