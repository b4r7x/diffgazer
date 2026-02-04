import type { AIProvider } from "@stargazer/schemas/config";
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
} from "../../shared/lib/config-store/store.js";

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

export const saveConfig = (input: SaveConfigRequest): void => {
  saveProviderCredentials({
    provider: input.provider,
    apiKey: input.apiKey,
    model: input.model,
  });
};

export const getConfig = (): ConfigResponse | null => {
  const active = getActiveProvider();
  if (!active) return null;

  const apiKey = getProviderApiKey(active.provider);
  if (!apiKey) return null;

  return { provider: active.provider, model: active.model };
};

export const checkConfig = (): ConfigCheckResponse => {
  const config = getConfig();
  if (!config) {
    return { configured: false };
  }
  return { configured: true, config };
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

export const deleteProvider = (providerId: AIProvider): DeleteProviderResponse => {
  const deleted = deleteProviderCredentials(providerId);

  return {
    deleted,
    provider: providerId,
  };
};

export const deleteConfig = (): DeleteConfigResponse | null => {
  const active = getActiveProvider();
  if (!active) return null;

  const apiKey = getProviderApiKey(active.provider);
  if (!apiKey) return null;

  const deleted = deleteProviderCredentials(active.provider);
  return { deleted };
};
