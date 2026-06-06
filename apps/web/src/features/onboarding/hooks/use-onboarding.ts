import {
  useDeleteProviderCredentials,
  useSaveConfig,
  useSaveSettings,
} from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import { getInitialWizardData, saveWizard, useWizardState } from "@diffgazer/core/onboarding";
import { useState } from "react";
import { useConfigActions } from "@/app/providers/config";
import { setConfiguredGuardCache } from "@/lib/config-guard-cache";

export function useOnboarding() {
  const { refresh: refreshConfig } = useConfigActions();
  const saveSettings = useSaveSettings();
  const saveConfig = useSaveConfig();
  const deleteCredentials = useDeleteProviderCredentials();

  const wizard = useWizardState(getInitialWizardData(), {
    saveCredentials: async (provider, apiKey) => {
      await saveConfig.mutateAsync({ provider, apiKey });
    },
    deleteCredentials: async (provider) => {
      await deleteCredentials.mutateAsync(provider);
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await saveWizard(wizard.wizardData, {
        saveSettings: (payload) => saveSettings.mutateAsync(payload),
        saveConfig: (payload) => saveConfig.mutateAsync(payload),
      });
      if (result.status === "partial") {
        const message = getErrorMessage(result.error, "Setup failed");
        setError(message);
        throw new Error(message);
      }
      wizard.acknowledgeEarlySave();
      await refreshConfig(true);
      setConfiguredGuardCache(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    currentStep: wizard.currentStep,
    wizardData: wizard.wizardData,
    // HorizontalStepper expects a mutable string[]; copy the readonly source.
    steps: [...wizard.steps],
    isFirstStep: wizard.isFirstStep,
    isLastStep: wizard.isLastStep,
    canProceed: wizard.canProceed,
    isSubmitting,
    isEarlySaving: wizard.isEarlySaving,
    error,
    next: wizard.next,
    back: wizard.back,
    updateData: wizard.updateData,
    setProvider: wizard.setProvider,
    complete,
    cleanupEarlySave: wizard.cleanupEarlySave,
  };
}
