import {
  useDeleteProviderCredentials,
  useSaveConfig,
  useSaveSettings,
} from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import { getInitialWizardData, saveWizard, useWizardState } from "@diffgazer/core/onboarding";
import { type AIProvider, PROVIDER_ENV_VARS } from "@diffgazer/core/schemas/config";
import { useRef, useState } from "react";
import { useConfigActions } from "@/hooks/use-config";
import { setConfiguredGuardCache } from "@/lib/config-guard-cache";

const EARLY_SAVE_CLEANUP_ERROR = "Failed to remove saved credentials";

export function useOnboarding() {
  const { refresh: refreshConfig } = useConfigActions();
  const saveSettings = useSaveSettings();
  const saveConfig = useSaveConfig();
  const deleteCredentials = useDeleteProviderCredentials();
  const earlySavedProviderRef = useRef<AIProvider | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wizard = useWizardState(getInitialWizardData(), {
    saveCredentials: async (provider, apiKey) => {
      await saveConfig.mutateAsync({
        provider,
        apiKey:
          apiKey === "env"
            ? { kind: "env", varName: PROVIDER_ENV_VARS[provider] }
            : { kind: "literal", value: apiKey },
      });
      earlySavedProviderRef.current = provider;
    },
    deleteCredentials: async (provider) => {
      await deleteCredentials.mutateAsync(provider);
    },
  });

  const clearEarlySaveState = () => {
    earlySavedProviderRef.current = null;
    wizard.acknowledgeEarlySave();
    setError((current) => (current?.startsWith(EARLY_SAVE_CLEANUP_ERROR) ? null : current));
  };

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
      clearEarlySaveState();
      await refreshConfig(true);
      setConfiguredGuardCache(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cleanupEarlySave = async () => {
    const provider = earlySavedProviderRef.current;
    if (!provider) {
      await wizard.cleanupEarlySave();
      return;
    }

    try {
      await deleteCredentials.mutateAsync(provider);
      clearEarlySaveState();
    } catch (cleanupError) {
      setError(
        `${EARLY_SAVE_CLEANUP_ERROR}: ${getErrorMessage(cleanupError, "Retry to remove them.")}`,
      );
      throw cleanupError;
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
    cleanupEarlySave,
  };
}
