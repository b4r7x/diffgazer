import {
  activateProvider as activateProviderInStore,
  deleteProviderCredentials as deleteProviderCredentialsInStore,
  getActiveProvider,
  getProjectInfo,
  getProviders,
  getSettings,
  saveProviderCredentials,
} from "../../shared/lib/config-store.js";
import type { ProviderStatus, SettingsConfig, ProjectInfo } from "../../shared/lib/config-store.js";

export const fetchProviders = (): ProviderStatus[] => getProviders();

export const fetchSettings = (): SettingsConfig => getSettings();

export const fetchProjectInfo = (projectRoot?: string): ProjectInfo =>
  getProjectInfo(projectRoot);

export const fetchActiveProvider = (): ProviderStatus | null => getActiveProvider();

export const persistProviderCredentials = (input: {
  provider: string;
  apiKey: string;
  model?: string;
}): ProviderStatus => saveProviderCredentials(input);

export const setActiveProvider = (input: {
  provider: string;
  model?: string;
}): ProviderStatus | null => activateProviderInStore(input);

export const removeProviderCredentials = (providerId: string): boolean =>
  deleteProviderCredentialsInStore(providerId);
