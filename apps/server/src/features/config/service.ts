import { type Result, ok } from "@stargazer/core";
import type { AIProvider } from "@stargazer/schemas/config";
import type { SecretsStorageError } from "../../shared/lib/config/types.js";
import type {
  ActivateProviderResponse,
  ConfigCheckResponse,
  ConfigResponse,
  DeleteConfigResponse,
  DeleteProviderResponse,
  InitResponse,
  ProvidersStatusResponse,
  SaveConfigRequest,
} from "./types.js";
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
): Result<void, SecretsStorageError> => {
  const result = saveProviderCredentials({
    provider: input.provider,
    apiKey: input.apiKey,
    model: input.model,
  });
  if (!result.ok) return result;
  return ok(undefined);
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
}): ActivateProviderResponse | null => {
  const active = activateProviderInStore(input);
  if (!active) return null;

  return {
    provider: active.provider,
    model: active.model,
  };
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
  const active = getActiveProvider();
  if (!active) return ok(null);

  const apiKeyResult = getProviderApiKey(active.provider);
  if (!apiKeyResult.ok) return apiKeyResult;
  if (!apiKeyResult.value) return ok(null);

  const deletedResult = deleteProviderCredentials(active.provider);
  if (!deletedResult.ok) return deletedResult;
  return ok({ deleted: deletedResult.value });
};
