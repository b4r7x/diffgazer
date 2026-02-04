import type {
  ActivateProviderResponse,
  DeleteProviderResponse,
  InitResponse,
  ProvidersStatusResponse,
  SaveConfigRequest,
} from "./types.js";
import {
  activateProvider as activateProviderInStore,
  deleteProviderCredentials,
  getProjectInfo,
  getProviders,
  getSettings,
  saveProviderCredentials,
} from "../../shared/lib/config-store.js";

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

export const activateProvider = (input: {
  provider: string;
  model?: string;
}): ActivateProviderResponse | null => {
  const active = activateProviderInStore(input);
  if (!active) return null;

  return {
    provider: active.provider,
    model: active.model,
  };
};

export const deleteProvider = (providerId: string): DeleteProviderResponse => {
  const deleted = deleteProviderCredentials(providerId);

  return {
    deleted,
    provider: providerId,
  };
};
