import { getErrorMessage } from "@diffgazer/core/errors";
import { useSubmitGuard } from "@diffgazer/core/forms";
import type { AIProvider, CredentialRef } from "@diffgazer/core/schemas/config";
import { toast } from "@diffgazer/ui/components/toast";
import { useRef, useState } from "react";
import { useProviders } from "./use-providers";

export type ApiKeyDialogOwner = {
  kind: "api-key";
  id: number;
  providerId: AIProvider;
};

export type ModelDialogOwner = {
  kind: "model";
  id: number;
  providerId: AIProvider;
};

type ProviderDialogOwner = ApiKeyDialogOwner | ModelDialogOwner;

export function useProviderManagement() {
  const { providers, isLoading, saveApiKey, removeApiKey, selectProvider } = useProviders();
  const [dialogOwner, setDialogOwner] = useState<ProviderDialogOwner | null>(null);
  const nextDialogOwnerId = useRef(0);
  const { isSubmitting, withGuard } = useSubmitGuard();

  const createModelDialogOwner = (providerId: AIProvider): ModelDialogOwner => {
    nextDialogOwnerId.current += 1;
    return { kind: "model", id: nextDialogOwnerId.current, providerId };
  };

  const openApiKeyDialog = (providerId: AIProvider) => {
    if (isSubmitting) return;
    nextDialogOwnerId.current += 1;
    setDialogOwner({ kind: "api-key", id: nextDialogOwnerId.current, providerId });
  };

  const openModelDialog = (providerId: AIProvider) => {
    if (isSubmitting) return;
    setDialogOwner(createModelDialogOwner(providerId));
  };

  const closeDialog = (owner: ProviderDialogOwner) => {
    setDialogOwner((current) => (current === owner ? null : current));
  };

  const handleSaveApiKey = async (
    owner: ApiKeyDialogOwner,
    value: string | CredentialRef,
    opts?: { openModelDialog?: boolean },
  ) => {
    const modelOwner = opts?.openModelDialog ? createModelDialogOwner(owner.providerId) : null;
    return withGuard(async () => {
      await saveApiKey(owner.providerId, value);
      setDialogOwner((current) => (current === owner ? modelOwner : current));
      toast.success("API Key Saved", { message: "Provider configured" });
    });
  };

  const handleRemoveKey = async (providerId: AIProvider) => {
    return withGuard(async () => {
      await removeApiKey(providerId);
      toast.success("API Key Removed", { message: "Provider key deleted" });
    }).catch((error) => {
      toast.error("Failed to Remove", { message: getErrorMessage(error, "Unknown error") });
      return false;
    });
  };

  const handleSelectProvider = async (
    providerId: AIProvider,
    providerName: string,
    model: string | undefined,
  ) => {
    if (isSubmitting) return false;
    if (!model) {
      toast.error("Model Required", { message: "Select a model first" });
      openModelDialog(providerId);
      return false;
    }
    return withGuard(async () => {
      await selectProvider(providerId, model);
      toast.success("Provider Activated", { message: `${providerName} is now active` });
    }).catch((error) => {
      toast.error("Failed to Activate", { message: getErrorMessage(error, "Unknown error") });
      return false;
    });
  };

  const handleSelectModel = async (owner: ModelDialogOwner, modelId: string) => {
    return withGuard(async () => {
      await selectProvider(owner.providerId, modelId);
      setDialogOwner((current) => (current === owner ? null : current));
      toast.success("Model Selected", { message: `Selected ${modelId}` });
    }).catch((error) => {
      toast.error("Failed to Select Model", { message: getErrorMessage(error, "Unknown error") });
      return false;
    });
  };

  return {
    providers,
    isLoading,
    isSubmitting,
    dialogOwner,
    openApiKeyDialog,
    openModelDialog,
    closeDialog,
    handleSaveApiKey,
    handleRemoveKey,
    handleSelectProvider,
    handleSelectModel,
  };
}
