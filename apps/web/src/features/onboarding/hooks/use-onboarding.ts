import { useConfigurationAction, useSaveSettings } from "@diffgazer/core/api/hooks";
import { getInitialWizardData, useWizardState } from "@diffgazer/core/onboarding";
import { ClientConfigurationActionResponseSchema } from "@diffgazer/core/schemas/config";
import { toast } from "@diffgazer/ui/components/toast";
import { useConfigActions } from "@/hooks/use-config";

export function useOnboarding() {
  const { refresh: refreshConfig } = useConfigActions();
  const saveSettings = useSaveSettings();
  const { mutateAsync: executeConfigurationAction } = useConfigurationAction();

  const wizard = useWizardState({
    initial: getInitialWizardData(),
    callbacks: {
      saveSettings: (payload) => saveSettings.mutateAsync(payload),
      runConfigurationAction: async (action) => {
        const response = await executeConfigurationAction(action);
        return ClientConfigurationActionResponseSchema.parse(response);
      },
    },
    onComplete: refreshConfig,
    onCleanupError: (message) => toast.error("Cleanup Failed", { message }),
  });

  return { ...wizard, steps: [...wizard.steps] };
}
