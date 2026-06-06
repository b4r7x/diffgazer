import { getErrorMessage } from "@diffgazer/core/errors";
import { useSubmitGuard } from "@diffgazer/core/forms";
import type { AIProvider, CredentialRef } from "@diffgazer/core/schemas/config";
import { toast } from "@diffgazer/ui/components/toast";
import { useState } from "react";
import { useProviders } from "./use-providers";

export function useProviderManagement() {
  const {
    providers,
    isLoading,
    saveApiKey,
    removeApiKey,
    selectProvider,
  } = useProviders();
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const { isSubmitting, withGuard } = useSubmitGuard();

  const handleSaveApiKey = async (
    providerId: AIProvider,
    value: string | CredentialRef,
    opts?: { openModelDialog?: boolean },
  ) => {
    await withGuard(async () => {
      await saveApiKey(providerId, value);
      setApiKeyDialogOpen(false);
      toast.success("API Key Saved", { message: "Provider configured" });
      if (opts?.openModelDialog) {
        setModelDialogOpen(true);
      }
    }).catch((error) => {
      toast.error("Failed to Save", { message: getErrorMessage(error, "Unknown error") });
    });
  };

  const handleRemoveKey = async (providerId: AIProvider) => {
    await withGuard(async () => {
      await removeApiKey(providerId);
      setApiKeyDialogOpen(false);
      toast.success("API Key Removed", { message: "Provider key deleted" });
    }).catch((error) => {
      toast.error("Failed to Remove", { message: getErrorMessage(error, "Unknown error") });
    });
  };

  const handleSelectProvider = async (
    providerId: AIProvider,
    providerName: string,
    model: string | undefined,
  ) => {
    if (!model) {
      toast.error("Model Required", { message: "Select a model first" });
      setModelDialogOpen(true);
      return;
    }
    await withGuard(async () => {
      await selectProvider(providerId, model);
      toast.success("Provider Activated", { message: `${providerName} is now active` });
    }).catch((error) => {
      toast.error("Failed to Activate", { message: getErrorMessage(error, "Unknown error") });
    });
  };

  const handleSelectModel = async (providerId: AIProvider, modelId: string) => {
    await withGuard(async () => {
      await selectProvider(providerId, modelId);
      setModelDialogOpen(false);
      toast.success("Model Selected", { message: `Selected ${modelId}` });
    }).catch((error) => {
      toast.error("Failed to Select Model", { message: getErrorMessage(error, "Unknown error") });
    });
  };

  return {
    providers,
    isLoading,
    isSubmitting,
    apiKeyDialogOpen,
    setApiKeyDialogOpen,
    modelDialogOpen,
    setModelDialogOpen,
    handleSaveApiKey,
    handleRemoveKey,
    handleSelectProvider,
    handleSelectModel,
  };
}
