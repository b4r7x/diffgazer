import { useState, useRef } from "react";
import { toast } from "diffui/components/toast";
import type { AIProvider } from "@diffgazer/schemas/config";
import { useProviders } from "./use-providers";

function useSubmitGuard() {
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const withGuard = <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (isSubmittingRef.current) return Promise.resolve(undefined);
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    return fn().finally(() => {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    });
  };

  return { isSubmitting, withGuard };
}

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
    value: string,
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
      toast.error("Failed to Save", { message: error instanceof Error ? error.message : "Unknown error" });
    });
  };

  const handleRemoveKey = async (providerId: AIProvider) => {
    await withGuard(async () => {
      await removeApiKey(providerId);
      setApiKeyDialogOpen(false);
      toast.success("API Key Removed", { message: "Provider key deleted" });
    }).catch((error) => {
      toast.error("Failed to Remove", { message: error instanceof Error ? error.message : "Unknown error" });
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
      toast.error("Failed to Activate", { message: error instanceof Error ? error.message : "Unknown error" });
    });
  };

  const handleSelectModel = async (providerId: AIProvider, modelId: string) => {
    await withGuard(async () => {
      await selectProvider(providerId, modelId);
      setModelDialogOpen(false);
      toast.success("Model Selected", { message: `Selected ${modelId}` });
    }).catch((error) => {
      toast.error("Failed to Select Model", { message: error instanceof Error ? error.message : "Unknown error" });
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
