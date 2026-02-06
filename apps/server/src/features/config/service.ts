import { type Result, ok, err, createError, getErrorMessage } from "@stargazer/core";
import type { AIProvider } from "@stargazer/schemas/config";
import { ErrorCode } from "@stargazer/schemas/errors";
import type { SecretsStorageError } from "../../shared/lib/config/types.js";
import type {
  ActivateProviderResponse,
  ConfigCheckResponse,
  ConfigResponse,
  DeleteConfigResponse,
  DeleteProviderResponse,
  InitResponse,
  OpenRouterModelsResponse,
  ProviderStatus,
  ProvidersStatusResponse,
  SaveConfigRequest,
} from "@stargazer/api";
import {
  activateProvider as activateProviderInStore,
  deleteProviderCredentials,
  getActiveProvider,
  getProjectInfo,
  getProviderApiKey,
  getProviders,
  getSettings,
  saveProviderCredentials,
} from "../../shared/lib/config/store.js";
import { getOpenRouterModelsWithCache } from "../../shared/lib/ai/openrouter-models.js";

export const getProvidersStatus = (): ProvidersStatusResponse => {
  const providers = getProviders();
  const activeProvider = providers.find((provider) => provider.isActive)?.provider;

  return {
    providers,
    activeProvider,
  };
};

export const getInitState = (projectRoot?: string): InitResponse => {
  const providers = getProviders();
  const activeProvider = providers.find((provider) => provider.isActive) ?? null;

  return {
    config: activeProvider
      ? { provider: activeProvider.provider, model: activeProvider.model }
      : null,
    settings: getSettings(),
    providers,
    configured: providers.some((provider) => provider.isActive),
    project: getProjectInfo(projectRoot),
  };
};

export const saveConfig = (
  input: SaveConfigRequest
): Result<ProviderStatus, SecretsStorageError> => {
  return saveProviderCredentials({
    provider: input.provider,
    apiKey: input.apiKey,
    model: input.model,
  });
};

export const getConfig = (): Result<ConfigResponse | null, SecretsStorageError> => {
  const active = getActiveProvider();
  if (!active) return ok(null);

  const apiKeyResult = getProviderApiKey(active.provider);
  if (!apiKeyResult.ok) return apiKeyResult;
  if (!apiKeyResult.value) return ok(null);

  return ok({ provider: active.provider, model: active.model });
};

export const checkConfig = (): Result<ConfigCheckResponse, SecretsStorageError> => {
  const configResult = getConfig();
  if (!configResult.ok) return configResult;
  if (!configResult.value) {
    return ok({ configured: false });
  }
  return ok({ configured: true, config: configResult.value });
};

export const activateProvider = (input: {
  provider: AIProvider;
  model?: string;
}): Result<ActivateProviderResponse, { message: string; code: string }> => {
  const { provider, model } = input;

  if (provider === "openrouter" && !model) {
    const existing = getProviders().find((p) => p.provider === "openrouter");
    if (!existing?.model) {
      return err(createError("INVALID_BODY", "Model is required for OpenRouter"));
    }
  }

  const active = activateProviderInStore(input);
  if (!active) {
    return err(createError("PROVIDER_NOT_FOUND", "Provider not found"));
  }

  return ok({ provider: active.provider, model: active.model });
};

export const deleteProvider = (
  providerId: AIProvider
): Result<DeleteProviderResponse, SecretsStorageError> => {
  const deletedResult = deleteProviderCredentials(providerId);
  if (!deletedResult.ok) return deletedResult;

  return ok({
    deleted: deletedResult.value,
    provider: providerId,
  });
};

export const deleteConfig = (): Result<DeleteConfigResponse | null, SecretsStorageError> => {
  const configResult = getConfig();
  if (!configResult.ok) return configResult;
  if (!configResult.value) return ok(null);

  const deletedResult = deleteProviderCredentials(configResult.value.provider);
  if (!deletedResult.ok) return deletedResult;
  return ok({ deleted: deletedResult.value });
};

export const getOpenRouterModels = async (): Promise<
  Result<OpenRouterModelsResponse, { message: string; code: string }>
> => {
  const apiKeyResult = getProviderApiKey("openrouter");
  if (!apiKeyResult.ok) return err(apiKeyResult.error);
  if (!apiKeyResult.value) {
    return err(
      createError(
        ErrorCode.API_KEY_MISSING,
        "OpenRouter API key is required to fetch models"
      )
    );
  }

  try {
    const result = await getOpenRouterModelsWithCache(apiKeyResult.value);
    return ok(result);
  } catch (error) {
    return err(
      createError(
        ErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, "Failed to fetch OpenRouter models")
      )
    );
  }
};
