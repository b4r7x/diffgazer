import {
  useDeleteProviderCredentials,
  useSaveConfig,
  useSaveSettings,
} from "@diffgazer/core/api/hooks";
import { getInitialWizardData, useWizardState } from "@diffgazer/core/onboarding";
import { toast } from "@diffgazer/ui/components/toast";
import { useConfigActions } from "@/hooks/use-config";

export function useOnboarding() {
  const { refresh: refreshConfig } = useConfigActions();
  const saveSettings = useSaveSettings();
  const saveConfig = useSaveConfig();
  const deleteCredentials = useDeleteProviderCredentials();

  const wizard = useWizardState({
    initial: getInitialWizardData(),
    callbacks: {
      saveSettings: (payload) => saveSettings.mutateAsync(payload),
      saveConfig: (payload) => saveConfig.mutateAsync(payload),
      deleteCredentials: (provider) => deleteCredentials.mutateAsync(provider),
    },
    onComplete: refreshConfig,
    onCleanupError: (message) => toast.error("Cleanup Failed", { message }),
  });

  return {
    currentStep: wizard.currentStep,
    wizardData: wizard.wizardData,
    // HorizontalStepper expects a mutable string[]; copy the readonly source.
    steps: [...wizard.steps],
    isFirstStep: wizard.isFirstStep,
    isLastStep: wizard.isLastStep,
    canProceed: wizard.canProceed,
    isSubmitting: wizard.isSubmitting,
    isEarlySaving: wizard.isEarlySaving,
    error: wizard.error,
    earlySaveError: wizard.earlySaveError,
    next: wizard.next,
    back: wizard.back,
    updateData: wizard.updateData,
    setProvider: wizard.setProvider,
    complete: wizard.complete,
    cleanupEarlySave: wizard.cleanupEarlySave,
  };
}
