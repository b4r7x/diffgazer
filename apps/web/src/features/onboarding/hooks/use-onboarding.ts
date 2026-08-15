import { useApi, useConfigurationAction, useSaveSettings } from "@diffgazer/core/api/hooks";
import {
  getInitialWizardData,
  type SaveWizardCallbacks,
  useWizardState,
} from "@diffgazer/core/onboarding";
import { ClientConfigurationActionResponseSchema } from "@diffgazer/core/schemas/config";
import { toast } from "@diffgazer/ui/components/toast";
import { useEffect, useRef, useState } from "react";
import { useConfigActions } from "@/hooks/use-config";

export function useOnboarding() {
  const api = useApi();
  const { refresh: refreshConfig } = useConfigActions();
  const saveSettings = useSaveSettings();
  const { mutateAsync: executeConfigurationAction } = useConfigurationAction();

  // One draft per mount: a fresh equivalent object on every render would make
  // useWizardState re-run its initial-draft reconciliation on every commit.
  const [initialDraft] = useState(() => getInitialWizardData());

  // Same reason, for the callbacks: useWizardState memoizes its cleanup chain on
  // this object's identity, so the calls read the current api/mutation handles
  // through a ref instead of handing the hook a new object every render.
  const latestRef = useRef({ api, saveSettings, executeConfigurationAction });
  latestRef.current = { api, saveSettings, executeConfigurationAction };
  const [callbacks] = useState<SaveWizardCallbacks>(() => ({
    saveSettings: (payload) => latestRef.current.saveSettings.mutateAsync(payload),
    runConfigurationAction: async (action) => {
      const response = await latestRef.current.executeConfigurationAction(action);
      return ClientConfigurationActionResponseSchema.parse(response);
    },
    revokeConfigurationOnPageHide: (configurationId, expectedRevision) => {
      latestRef.current.api.revokeConfigurationOnPageHide(configurationId, expectedRevision);
    },
  }));

  const wizard = useWizardState({
    initial: initialDraft,
    callbacks,
    onComplete: refreshConfig,
    onCleanupError: (message) => toast.error("Cleanup Failed", { message }),
  });

  const revokeOnPageHideRef = useRef(wizard.revokeCreatedConfigurationOnPageHide);
  revokeOnPageHideRef.current = wizard.revokeCreatedConfigurationOnPageHide;

  useEffect(() => {
    const revokeDraftOnPageHide = () => {
      revokeOnPageHideRef.current();
    };
    window.addEventListener("pagehide", revokeDraftOnPageHide);
    return () => window.removeEventListener("pagehide", revokeDraftOnPageHide);
  }, []);

  return { ...wizard, steps: [...wizard.steps] };
}
