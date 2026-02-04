import { resolveProjectRoot } from "../paths.js";
import { SecretsStorageError } from "./errors.js";
import type { AIProvider } from "@repo/schemas/config";
import {
  deleteKeyringSecret,
  isKeyringAvailable,
  readKeyringSecret,
  writeKeyringSecret,
} from "./keyring.js";
import {
  DEFAULT_PROVIDERS,
  DEFAULT_SETTINGS,
  loadConfig,
  loadSecrets,
  loadTrust,
  persistConfig,
  persistSecrets,
  persistTrust,
  readOrCreateProjectFile,
  removeSecretsFile,
  syncProvidersWithSecrets,
} from "./state.js";
import type {
  ProjectInfo,
  ProviderStatus,
  SecretsStorage,
  SettingsConfig,
  TrustConfig,
  TrustState,
  ConfigState,
  SecretsState,
} from "./types.js";

const resolveSecretsStorage = (
  storage?: SecretsStorage | null,
): SecretsStorage => storage ?? "file";

const getApiKeyName = (provider: string): string => `api_key_${provider}`;

let configState: ConfigState = loadConfig();
let secretsState: SecretsState = loadSecrets();
let trustState: TrustState = loadTrust();

configState.providers = syncProvidersWithSecrets(
  configState.providers,
  secretsState,
  resolveSecretsStorage(configState.settings.secretsStorage),
);

const persistFileSecrets = (): void => {
  if (Object.keys(secretsState.providers).length === 0) {
    removeSecretsFile();
    return;
  }

  persistSecrets(secretsState);
};

const setActiveProvider = (
  providerId: string,
  options: {
    model?: string;
    hasApiKey?: boolean;
    preserveModel?: boolean;
  } = {},
): void => {
  const { model, hasApiKey, preserveModel = false } = options;
  configState.providers = configState.providers.map((item) => {
    if (item.provider !== providerId) {
      return { ...item, isActive: false };
    }

    const nextModel = preserveModel && model === undefined ? item.model : model;
    return {
      ...item,
      hasApiKey: hasApiKey ?? item.hasApiKey,
      isActive: true,
      model: nextModel,
    };
  });
};

const ensureProvider = (providerId: AIProvider): ProviderStatus => {
  const existing = configState.providers.find(
    (provider) => provider.provider === providerId,
  );
  if (existing) return existing;

  const created: ProviderStatus = {
    provider: providerId,
    hasApiKey:
      resolveSecretsStorage(configState.settings.secretsStorage) === "file"
        ? secretsState.providers[providerId] !== undefined
        : false,
    isActive: false,
  };

  configState.providers = [...configState.providers, created];
  return created;
};

const migrateSecretsStorage = (
  fromStorage: SecretsStorage,
  toStorage: SecretsStorage,
): void => {
  if (fromStorage === toStorage) return;

  if (fromStorage === "file" && toStorage === "keyring") {
    if (!isKeyringAvailable()) {
      throw new SecretsStorageError(
        "KEYRING_UNAVAILABLE",
        "System keyring is not available",
      );
    }

    for (const [providerId, apiKey] of Object.entries(secretsState.providers)) {
      writeKeyringSecret(getApiKeyName(providerId), apiKey);
    }

    secretsState = { providers: {} };
    try {
      removeSecretsFile();
    } catch (error) {
      console.warn(
        `[stargazer] Failed to remove secrets file after migration: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return;
  }

  if (fromStorage === "keyring" && toStorage === "file") {
    const nextSecrets: Record<string, string> = {};
    for (const provider of configState.providers) {
      if (!provider.hasApiKey) continue;
      const secret = readKeyringSecret(getApiKeyName(provider.provider));
      if (secret === null) {
        throw new SecretsStorageError(
          "SECRET_NOT_FOUND",
          `Secret for provider '${provider.provider}' not found in keyring`,
        );
      }
      nextSecrets[provider.provider] = secret;
    }

    secretsState = { providers: nextSecrets };
    persistFileSecrets();

    for (const providerId of Object.keys(nextSecrets)) {
      try {
        deleteKeyringSecret(getApiKeyName(providerId));
      } catch (error) {
        console.warn(
          `[stargazer] Failed to delete keyring secret for '${providerId}': ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }
};

export const getSettings = (): SettingsConfig => ({ ...configState.settings });

export const updateSettings = (
  patch: Partial<SettingsConfig>,
): SettingsConfig => {
  const nextSettings: SettingsConfig = {
    ...configState.settings,
    ...patch,
  };

  const currentStorage = resolveSecretsStorage(configState.settings.secretsStorage);
  const nextStorage = resolveSecretsStorage(nextSettings.secretsStorage);

  if (currentStorage !== nextStorage) {
    migrateSecretsStorage(currentStorage, nextStorage);
    if (nextStorage === "file") {
      configState.providers = syncProvidersWithSecrets(
        configState.providers,
        secretsState,
        nextStorage,
      );
    }
  }

  configState.settings = nextSettings;

  persistConfig(configState);
  return getSettings();
};

export const getProviders = (): ProviderStatus[] =>
  configState.providers.map((provider) => ({ ...provider }));

export const getActiveProvider = (): ProviderStatus | null => {
  const active = configState.providers.find((provider) => provider.isActive);
  return active ? { ...active } : null;
};

export const getProviderApiKey = (providerId: string): string | null => {
  if (resolveSecretsStorage(configState.settings.secretsStorage) === "file") {
    return secretsState.providers[providerId] ?? null;
  }

  return readKeyringSecret(getApiKeyName(providerId));
};

export const getProjectInfo = (projectRoot?: string): ProjectInfo => {
  const resolvedRoot = resolveProjectRoot({
    header: projectRoot ?? null,
    env: process.env.STARGAZER_PROJECT_ROOT ?? null,
    cwd: process.cwd(),
  });
  const projectFile = readOrCreateProjectFile(resolvedRoot);
  const trust = trustState.projects[projectFile.projectId] ?? null;

  return {
    path: resolvedRoot,
    projectId: projectFile.projectId,
    trust,
  };
};

export const getTrust = (projectId: string): TrustConfig | null =>
  trustState.projects[projectId] ?? null;

export const listTrustedProjects = (): TrustConfig[] =>
  Object.values(trustState.projects);

export const saveTrust = (config: TrustConfig): TrustConfig => {
  trustState.projects[config.projectId] = config;
  persistTrust(trustState);
  return config;
};

export const removeTrust = (projectId: string): boolean => {
  const existed = projectId in trustState.projects;
  if (!existed) return false;

  delete trustState.projects[projectId];
  persistTrust(trustState);
  return true;
};

export const saveProviderCredentials = (input: {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}): ProviderStatus => {
  const { provider, apiKey, model } = input;
  const storage = resolveSecretsStorage(configState.settings.secretsStorage);

  if (storage === "file") {
    secretsState.providers[provider] = apiKey;
    persistSecrets(secretsState);
  } else {
    writeKeyringSecret(getApiKeyName(provider), apiKey);
    if (provider in secretsState.providers) {
      delete secretsState.providers[provider];
      persistFileSecrets();
    }
  }

  ensureProvider(provider);
  setActiveProvider(provider, { model, hasApiKey: true });

  persistConfig(configState);
  return getActiveProvider() ?? { ...ensureProvider(provider) };
};

export const activateProvider = (input: {
  provider: AIProvider;
  model?: string;
}): ProviderStatus | null => {
  const { provider, model } = input;
  const existing = configState.providers.find(
    (item) => item.provider === provider,
  );
  if (!existing) return null;

  setActiveProvider(provider, { model, preserveModel: true });

  persistConfig(configState);
  return getActiveProvider();
};

export const deleteProviderCredentials = (providerId: AIProvider): boolean => {
  const providerExists = configState.providers.some(
    (item) => item.provider === providerId,
  );
  let hadSecret = false;

  if (resolveSecretsStorage(configState.settings.secretsStorage) === "file") {
    hadSecret = providerId in secretsState.providers;
    if (hadSecret) {
      delete secretsState.providers[providerId];
    }

    persistFileSecrets();
  } else {
    hadSecret = deleteKeyringSecret(getApiKeyName(providerId));
    if (providerId in secretsState.providers) {
      delete secretsState.providers[providerId];
      persistFileSecrets();
    }
  }

  configState.providers = configState.providers.map((item) => {
    if (item.provider !== providerId) {
      return item;
    }

    return {
      ...item,
      hasApiKey: false,
      isActive: false,
      model: undefined,
    };
  });

  persistConfig(configState);
  return providerExists || hadSecret;
};

export const resetConfigStore = (): void => {
  const previousProviders = configState.providers;
  if (resolveSecretsStorage(configState.settings.secretsStorage) === "keyring") {
    for (const provider of previousProviders) {
      try {
        deleteKeyringSecret(getApiKeyName(provider.provider));
      } catch (error) {
        console.warn(
          `[stargazer] Failed to delete keyring secret for '${provider.provider}': ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  configState = {
    settings: { ...DEFAULT_SETTINGS },
    providers: DEFAULT_PROVIDERS.map((provider) => ({ ...provider })),
  };
  secretsState = { providers: {} };
  trustState = { projects: {} };

  persistConfig(configState);
  persistSecrets(secretsState);
  persistTrust(trustState);
};

export const getStoreSnapshot = (): {
  config: ConfigState;
  secrets: SecretsState;
  trust: TrustState;
} => ({
  config: configState,
  secrets: secretsState,
  trust: trustState,
});
