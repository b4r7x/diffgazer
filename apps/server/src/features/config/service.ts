import type {
  ActivateProviderResponse,
  DeleteProviderResponse,
  InitResponse,
  ProvidersStatusResponse,
  SaveConfigRequest,
} from "./types.js";
import {
  fetchProjectInfo,
  fetchProviders,
  fetchSettings,
  persistProviderCredentials,
  removeProviderCredentials,
  setActiveProvider,
} from "./repo.js";

export const getProvidersStatus = (): ProvidersStatusResponse => {
  const providers = fetchProviders();
  const activeProvider = providers.find((provider) => provider.isActive)?.provider;

  return {
    providers,
    activeProvider,
  };
};

export const getInitState = (projectRoot?: string): InitResponse => {
  const providers = fetchProviders();
  const activeProvider = providers.find((provider) => provider.isActive) ?? null;

  return {
    config: activeProvider
      ? { provider: activeProvider.provider, model: activeProvider.model }
      : null,
    settings: fetchSettings(),
    providers,
    configured: providers.some((provider) => provider.isActive),
    project: fetchProjectInfo(projectRoot),
  };
};

export const saveConfig = (input: SaveConfigRequest): void => {
  persistProviderCredentials({
    provider: input.provider,
    apiKey: input.apiKey,
    model: input.model,
  });
};

export const activateProvider = (input: {
  provider: string;
  model?: string;
}): ActivateProviderResponse | null => {
  const active = setActiveProvider(input);
  if (!active) return null;

  return {
    provider: active.provider,
    model: active.model,
  };
};

export const deleteProvider = (providerId: string): DeleteProviderResponse => {
  const deleted = removeProviderCredentials(providerId);

  return {
    deleted,
    provider: providerId,
  };
};
