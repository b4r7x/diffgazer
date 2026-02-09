import { resolveProjectRoot } from "../paths.js";
import { type Result, ok, err } from "@diffgazer/core/result";
import { createError } from "@diffgazer/core/errors";
import type { AIProvider, ProjectInfo, ProviderStatus, SecretsStorage, SettingsConfig, TrustConfig } from "@diffgazer/schemas/config";
import type { SecretsStorageError, SecretsStorageErrorCode, ConfigState, SecretsState, TrustState } from "./types.js";
import {
  deleteKeyringSecret,
  isKeyringAvailable,
  readKeyringSecret,
  writeKeyringSecret,
} from "./keyring.js";
import {
  loadConfig,
  loadSecrets,
  loadTrust,
  persistConfigAsync,
  persistSecretsAsync,
  persistTrustAsync,
  readOrCreateProjectFile,
  removeSecretsFile,
  syncProvidersWithSecrets,
} from "./state.js";

const getApiKeyName = (provider: string): string => `api_key_${provider}`;

export interface ConfigStore {
  getSettings(): SettingsConfig;
  updateSettings(patch: Partial<SettingsConfig>): Result<SettingsConfig, SecretsStorageError>;
  getProviders(): ProviderStatus[];
  getActiveProvider(): ProviderStatus | null;
  getProviderApiKey(providerId: string): Result<string | null, SecretsStorageError>;
  getProjectInfo(projectRoot?: string): ProjectInfo;
  getTrust(projectId: string): TrustConfig | null;
  listTrustedProjects(): TrustConfig[];
  saveTrust(config: TrustConfig): TrustConfig;
  removeTrust(projectId: string): boolean;
  saveProviderCredentials(input: { provider: AIProvider; apiKey: string; model?: string }): Result<ProviderStatus, SecretsStorageError>;
  activateProvider(input: { provider: AIProvider; model?: string }): ProviderStatus | null;
  deleteProviderCredentials(providerId: AIProvider): Result<boolean, SecretsStorageError>;
}

export function createConfigStore(): ConfigStore {
  let configState: ConfigState = loadConfig();
  let secretsState: SecretsState = loadSecrets();
  let trustState: TrustState = loadTrust();

  configState.providers = syncProvidersWithSecrets(
    configState.providers,
    secretsState,
    configState.settings.secretsStorage ?? "file",
  );

  const persistFileSecrets = (): void => {
    if (Object.keys(secretsState.providers).length === 0) {
      removeSecretsFile();
      return;
    }

    persistSecretsAsync(secretsState).catch((e) =>
      console.warn("[config] Failed to persist secrets:", e),
    );
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
        (configState.settings.secretsStorage ?? "file") === "file"
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
  ): Result<void, SecretsStorageError> => {
    if (fromStorage === toStorage) return ok(undefined);

    if (fromStorage === "file" && toStorage === "keyring") {
      if (!isKeyringAvailable()) {
        return err(
          createError<SecretsStorageErrorCode>("KEYRING_UNAVAILABLE", "System keyring is not available")
        );
      }

      for (const [providerId, apiKey] of Object.entries(secretsState.providers)) {
        const writeResult = writeKeyringSecret(getApiKeyName(providerId), apiKey);
        if (!writeResult.ok) return writeResult;
      }

      secretsState = { providers: {} };
      try {
        removeSecretsFile();
      } catch (error) {
        console.warn(
          `[diffgazer] Failed to remove secrets file after migration: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      return ok(undefined);
    }

    if (fromStorage === "keyring" && toStorage === "file") {
      const nextSecrets: Record<string, string> = {};
      for (const provider of configState.providers) {
        if (!provider.hasApiKey) continue;
        const secretResult = readKeyringSecret(getApiKeyName(provider.provider));
        if (!secretResult.ok) return secretResult;
        if (secretResult.value === null) {
          return err(
            createError<SecretsStorageErrorCode>(
              "SECRET_NOT_FOUND",
              `Secret for provider '${provider.provider}' not found in keyring`
            )
          );
        }
        nextSecrets[provider.provider] = secretResult.value;
      }

      secretsState = { providers: nextSecrets };
      persistFileSecrets();

      for (const providerId of Object.keys(nextSecrets)) {
        const deleteResult = deleteKeyringSecret(getApiKeyName(providerId));
        if (!deleteResult.ok) {
          console.warn(
            `[diffgazer] Failed to delete keyring secret for '${providerId}': ${deleteResult.error.message}`,
          );
        }
      }
    }

    return ok(undefined);
  };

  const getSettings = (): SettingsConfig => ({ ...configState.settings });

  const updateSettings = (
    patch: Partial<SettingsConfig>,
  ): Result<SettingsConfig, SecretsStorageError> => {
    const nextSettings: SettingsConfig = {
      ...configState.settings,
      ...patch,
    };

    const currentStorage = (configState.settings.secretsStorage ?? "file");
    const nextStorage = nextSettings.secretsStorage ?? "file";

    if (currentStorage !== nextStorage) {
      const migrateResult = migrateSecretsStorage(currentStorage, nextStorage);
      if (!migrateResult.ok) return migrateResult;
      if (nextStorage === "file") {
        configState.providers = syncProvidersWithSecrets(
          configState.providers,
          secretsState,
          nextStorage,
        );
      }
    }

    configState.settings = nextSettings;

    persistConfigAsync(configState).catch((e) =>
      console.warn("[config] Failed to persist config:", e),
    );
    return ok(getSettings());
  };

  const getProviders = (): ProviderStatus[] =>
    configState.providers.map((provider) => ({ ...provider }));

  const getActiveProvider = (): ProviderStatus | null => {
    const active = configState.providers.find((provider) => provider.isActive);
    return active ? { ...active } : null;
  };

  const getProviderApiKey = (
    providerId: string
  ): Result<string | null, SecretsStorageError> => {
    if ((configState.settings.secretsStorage ?? "file") === "file") {
      return ok(secretsState.providers[providerId] ?? null);
    }

    return readKeyringSecret(getApiKeyName(providerId));
  };

  const getProjectInfo = (projectRoot?: string): ProjectInfo => {
    const resolvedRoot = resolveProjectRoot({
      header: projectRoot ?? null,
      env: process.env.DIFFGAZER_PROJECT_ROOT ?? null,
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

  const getTrust = (projectId: string): TrustConfig | null =>
    trustState.projects[projectId] ?? null;

  const listTrustedProjects = (): TrustConfig[] =>
    Object.values(trustState.projects);

  const saveTrust = (config: TrustConfig): TrustConfig => {
    trustState.projects[config.projectId] = config;
    persistTrustAsync(trustState).catch((e) =>
      console.warn("[config] Failed to persist trust:", e),
    );
    return config;
  };

  const removeTrust = (projectId: string): boolean => {
    const existed = projectId in trustState.projects;
    if (!existed) return false;

    delete trustState.projects[projectId];
    persistTrustAsync(trustState).catch((e) =>
      console.warn("[config] Failed to persist trust:", e),
    );
    return true;
  };

  const saveProviderCredentials = (input: {
    provider: AIProvider;
    apiKey: string;
    model?: string;
  }): Result<ProviderStatus, SecretsStorageError> => {
    const { provider, apiKey, model } = input;
    const storage = (configState.settings.secretsStorage ?? "file");

    if (storage === "file") {
      secretsState.providers[provider] = apiKey;
      persistSecretsAsync(secretsState).catch((e) =>
        console.warn("[config] Failed to persist secrets:", e),
      );
    } else {
      const writeResult = writeKeyringSecret(getApiKeyName(provider), apiKey);
      if (!writeResult.ok) return writeResult;
      if (provider in secretsState.providers) {
        delete secretsState.providers[provider];
        persistFileSecrets();
      }
    }

    ensureProvider(provider);

    if (!model) {
      configState.providers = configState.providers.map((item) => {
        if (item.provider !== provider) return item;
        const hasModel = Boolean(item.model);
        return {
          ...item,
          hasApiKey: true,
          isActive: hasModel ? item.isActive : false,
        };
      });
    } else {
      setActiveProvider(provider, { model, hasApiKey: true });
    }

    persistConfigAsync(configState).catch((e) =>
      console.warn("[config] Failed to persist config:", e),
    );
    return ok(getActiveProvider() ?? { ...ensureProvider(provider) });
  };

  const activateProvider = (input: {
    provider: AIProvider;
    model?: string;
  }): ProviderStatus | null => {
    const { provider, model } = input;
    const existing = configState.providers.find(
      (item) => item.provider === provider,
    );
    if (!existing) return null;
    if (!model && !existing.model) return null;

    setActiveProvider(provider, { model, preserveModel: true });

    persistConfigAsync(configState).catch((e) =>
      console.warn("[config] Failed to persist config:", e),
    );
    return getActiveProvider();
  };

  const deleteProviderCredentials = (
    providerId: AIProvider
  ): Result<boolean, SecretsStorageError> => {
    const providerExists = configState.providers.some(
      (item) => item.provider === providerId,
    );
    let hadSecret = false;

    if ((configState.settings.secretsStorage ?? "file") === "file") {
      hadSecret = providerId in secretsState.providers;
      if (hadSecret) {
        delete secretsState.providers[providerId];
      }

      persistFileSecrets();
    } else {
      const deleteResult = deleteKeyringSecret(getApiKeyName(providerId));
      if (!deleteResult.ok) return deleteResult;
      hadSecret = deleteResult.value;
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

    persistConfigAsync(configState).catch((e) =>
      console.warn("[config] Failed to persist config:", e),
    );
    return ok(providerExists || hadSecret);
  };

  return {
    getSettings,
    updateSettings,
    getProviders,
    getActiveProvider,
    getProviderApiKey,
    getProjectInfo,
    getTrust,
    listTrustedProjects,
    saveTrust,
    removeTrust,
    saveProviderCredentials,
    activateProvider,
    deleteProviderCredentials,
  };
}

// Default singleton instance
const defaultStore = createConfigStore();

export const {
  getSettings,
  updateSettings,
  getProviders,
  getActiveProvider,
  getProviderApiKey,
  getProjectInfo,
  getTrust,
  listTrustedProjects,
  saveTrust,
  removeTrust,
  saveProviderCredentials,
  activateProvider,
  deleteProviderCredentials,
} = defaultStore;
