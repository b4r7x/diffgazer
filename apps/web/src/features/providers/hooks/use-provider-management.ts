import { useState, useCallback, useRef } from "react";
import { useToast } from "@/components/ui/toast";
import type { AIProvider } from "@stargazer/schemas/config";
import { useProviders } from "./use-providers";

export function useProviderManagement() {
  const {
    providers,
    isLoading,
    saveApiKey,
    removeApiKey,
    selectProvider,
  } = useProviders();
  const { showToast } = useToast();

  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSaveApiKey = useCallback(async (
    providerId: AIProvider,
    value: string,
    opts?: { openModelDialog?: boolean },
  ) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await saveApiKey(providerId, value);
      setApiKeyDialogOpen(false);
      showToast({ variant: "success", title: "API Key Saved", message: "Provider configured" });
      if (opts?.openModelDialog) {
        setModelDialogOpen(true);
      }
    } catch (error) {
      showToast({ variant: "error", title: "Failed to Save", message: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [saveApiKey, showToast]);

  const handleRemoveKey = useCallback(async (providerId: AIProvider) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await removeApiKey(providerId);
      setApiKeyDialogOpen(false);
      showToast({ variant: "success", title: "API Key Removed", message: "Provider key deleted" });
    } catch (error) {
      showToast({ variant: "error", title: "Failed to Remove", message: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [removeApiKey, showToast]);

  const handleSelectProvider = useCallback(async (
    providerId: AIProvider,
    providerName: string,
    model: string | undefined,
  ) => {
    if (isSubmittingRef.current) return;
    if (providerId === "openrouter" && !model) {
      showToast({ variant: "error", title: "Model Required", message: "Select a model for OpenRouter first" });
      setModelDialogOpen(true);
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await selectProvider(providerId, model);
      showToast({ variant: "success", title: "Provider Activated", message: `${providerName} is now active` });
    } catch (error) {
      showToast({ variant: "error", title: "Failed to Activate", message: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [selectProvider, showToast]);

  const handleSelectModel = useCallback(async (providerId: AIProvider, modelId: string) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await selectProvider(providerId, modelId);
      setModelDialogOpen(false);
      showToast({ variant: "success", title: "Model Selected", message: `Selected ${modelId}` });
    } catch (error) {
      showToast({ variant: "error", title: "Failed to Select Model", message: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [selectProvider, showToast]);

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
