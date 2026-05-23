import { type Result, ok, err } from "@diffgazer/core/result";
import { createError } from "@diffgazer/core/errors";
import type { AIProvider, SetupField, SetupStatus } from "@diffgazer/core/schemas/config";
import { UserConfigSchema } from "@diffgazer/core/schemas/config";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { SecretsStorageError } from "../../shared/lib/config/types.js";
import type { AppError } from "@diffgazer/core/errors";
import type {
  ActivateProviderResponse,
  ConfigCheckResponse,
  CurrentConfigResponse as ConfigResponse,
  DeleteConfigResponse,
  DeleteProviderCredentialsResponse as DeleteProviderResponse,
  InitResponse,
  OpenRouterModelsResponse,
  ProviderStatus,
  ProvidersStatusResponse,
  SaveConfigRequest,
} from "@diffgazer/core/schemas/config";
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

function isKeyReadable(provider: { provider: string } | null): boolean {
  if (!provider) return false;
  const keyResult = getProviderApiKey(provider.provider);
  return keyResult.ok && keyResult.value !== null;
}

export const getSetupStatus = (projectRoot?: string): SetupStatus => {
  const settings = getSettings();
  const providers = getProviders();
  const activeProvider = providers.find((p) => p.isActive) ?? null;
  const project = getProjectInfo(projectRoot);

  const hasSecretsStorage = settings.secretsStorage !== null;
  const hasProvider = activeProvider !== null && isKeyReadable(activeProvider);
  const hasModel = Boolean(activeProvider?.model);
  const hasTrust = Boolean(project.trust?.capabilities.readFiles);

  const missing: SetupField[] = [];
  if (!hasSecretsStorage) missing.push("secretsStorage");
  if (!hasProvider) missing.push("provider");
  if (!hasModel) missing.push("model");
  if (!hasTrust) missing.push("trust");

  const isConfigured = hasSecretsStorage && hasProvider && hasModel;

  return {
    hasSecretsStorage,
    hasProvider,
    hasModel,
    hasTrust,
    isConfigured,
    isReady: isConfigured && hasTrust,
    missing,
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
    setup: getSetupStatus(projectRoot),
  };
};

export const saveConfig = (
  input: SaveConfigRequest
): Promise<Result<ProviderStatus, SecretsStorageError>> => {
  // apiKey may be a string (legacy/literal) or CredentialRef (structured)
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

export const activateProvider = async (input: {
  provider: AIProvider;
  model?: string;
}): Promise<Result<ActivateProviderResponse, { message: string; code: string }>> => {
  const { provider, model } = input;

  const existing = getProviders().find((p) => p.provider === provider);
  if (!existing) {
    return err(createError("PROVIDER_NOT_FOUND", "Provider not found"));
  }

  if (!model && !existing.model) {
    return err(createError("INVALID_BODY", "Model selection is required"));
  }

  // Block activation if the provider has no API key configured
  const apiKeyResult = getProviderApiKey(provider);
  if (apiKeyResult.ok && !apiKeyResult.value) {
    return err(createError("INVALID_BODY", "API key required before selecting model"));
  }

  // Validate the model against provider-level constraints
  const effectiveModel = model ?? existing.model;
  if (effectiveModel) {
    const now = new Date().toISOString();
    const validation = UserConfigSchema.safeParse({
      provider,
      model: effectiveModel,
      createdAt: now,
      updatedAt: now,
    });
    if (!validation.success) {
      return err(createError("INVALID_BODY", "Model is not valid for the selected provider"));
    }
  }

  const result = await activateProviderInStore(input);
  if (!result.ok) return result;
  if (!result.value) {
    return err(createError("PROVIDER_NOT_FOUND", "Provider not found"));
  }

  return ok({ provider: result.value.provider, model: result.value.model });
};

export const deleteProvider = async (
  providerId: AIProvider
): Promise<Result<DeleteProviderResponse, SecretsStorageError>> => {
  const deletedResult = await deleteProviderCredentials(providerId);
  if (!deletedResult.ok) return deletedResult;

  return ok({
    deleted: deletedResult.value,
    provider: providerId,
  });
};

export const deleteConfig = async (): Promise<Result<DeleteConfigResponse, SecretsStorageError | AppError<"CONFIG_NOT_FOUND">>> => {
  const configResult = getConfig();
  if (!configResult.ok) return configResult;
  if (!configResult.value) {
    return err(createError(ErrorCode.CONFIG_NOT_FOUND, "No active configuration to delete"));
  }

  const deletedResult = await deleteProviderCredentials(configResult.value.provider);
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

  const result = await getOpenRouterModelsWithCache(apiKeyResult.value);
  if (!result.ok) {
    return err(
      createError(
        ErrorCode.INTERNAL_ERROR,
        result.error.message
      )
    );
  }
  return ok(result.value);
};
