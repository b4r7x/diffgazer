import { resolveProjectRoot } from "../paths.js";
import { type Result, ok, err } from "@diffgazer/core/result";
import type {
  AIProvider,
  ProjectInfo,
  ProviderStatus,
  SettingsConfig,
  TrustConfig,
} from "@diffgazer/core/schemas/config";
import type {
  ConfigState,
  SecretsState,
  SecretsStorageError,
  TrustState,
} from "./types.js";
import {
  deleteKeyringSecret,
  readKeyringSecret,
  writeKeyringSecret,
} from "./keyring.js";
import {
  loadConfig,
  loadSecrets,
  loadTrust,
  persistConfigAsync,
  persistSecrets,
  persistSecretsAsync,
  persistTrustAsync,
  readOrCreateProjectFile,
  removeSecretsFile,
  syncProvidersWithSecrets,
} from "./state.js";
import {
  activeProvider,
  applyActiveProvider,
  applyCredentialsWithoutModel,
  clearProviderCredentials,
  effectiveStorage,
  ensureProviderEntry,
  fileHasSecret,
  isFileStorage,
} from "./providers-state.js";
import {
  finalizeKeyringDeletions,
  getApiKeyName,
  migrateSecretsStorage,
} from "./secrets-migration.js";

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
    effectiveStorage(configState),
  );

  const persistConfig = (): void => {
    persistConfigAsync(configState).catch((e) =>
      console.warn("[config] Failed to persist config:", e),
    );
  };

  const persistTrust = (): void => {
    persistTrustAsync(trustState).catch((e) =>
      console.warn("[config] Failed to persist trust:", e),
    );
  };

  const persistFileSecrets = (): void => {
    if (Object.keys(secretsState.providers).length === 0) {
      removeSecretsFile();
      return;
    }

    persistSecretsAsync(secretsState).catch((e) =>
      console.warn("[config] Failed to persist secrets:", e),
    );
  };

  const persistFileSecretsSync = (): void => {
    if (Object.keys(secretsState.providers).length === 0) {
      removeSecretsFile();
      return;
    }
    persistSecrets(secretsState);
  };

  const getSettings = (): SettingsConfig => ({ ...configState.settings });

  const updateSettings = (
    patch: Partial<SettingsConfig>,
  ): Result<SettingsConfig, SecretsStorageError> => {
    const nextSettings: SettingsConfig = {
      ...configState.settings,
      ...patch,
    };

    const currentStorage = effectiveStorage(configState);
    const nextStorage = nextSettings.secretsStorage ?? "file";

    if (currentStorage !== nextStorage) {
      const migrateResult = migrateSecretsStorage(
        configState,
        secretsState,
        currentStorage,
        nextStorage,
      );
      if (!migrateResult.ok) return migrateResult;
      secretsState = migrateResult.value.nextSecrets;
      if (nextStorage === "file") {
        // Persist the file copy synchronously BEFORE deleting keyring entries.
        // If we deleted keyring first, a crash before the file write would lose
        // the secret in both stores. With this order a crash leaves a (stale)
        // keyring copy that the migration can safely re-read on the next run.
        persistFileSecretsSync();
        configState.providers = syncProvidersWithSecrets(
          configState.providers,
          secretsState,
          nextStorage,
        );
        finalizeKeyringDeletions(migrateResult.value.keyringDeletions);
      }
    }

    configState.settings = nextSettings;
    persistConfig();
    return ok(getSettings());
  };

  const getProviders = (): ProviderStatus[] =>
    configState.providers.map((provider) => ({ ...provider }));

  const getActiveProvider = (): ProviderStatus | null => activeProvider(configState);

  const getProviderApiKey = (
    providerId: string,
  ): Result<string | null, SecretsStorageError> => {
    if (isFileStorage(configState)) {
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
    persistTrust();
    return config;
  };

  const removeTrust = (projectId: string): boolean => {
    if (!(projectId in trustState.projects)) return false;
    delete trustState.projects[projectId];
    persistTrust();
    return true;
  };

  const saveProviderCredentials = (input: {
    provider: AIProvider;
    apiKey: string;
    model?: string;
  }): Result<ProviderStatus, SecretsStorageError> => {
    const { provider, apiKey, model } = input;

    if (isFileStorage(configState)) {
      secretsState.providers[provider] = apiKey;
      persistFileSecrets();
    } else {
      const writeResult = writeKeyringSecret(getApiKeyName(provider), apiKey);
      if (!writeResult.ok) return writeResult;
      if (fileHasSecret(secretsState, provider)) {
        delete secretsState.providers[provider];
        persistFileSecrets();
      }
    }

    const ensured = ensureProviderEntry(configState.providers, provider, true);
    configState.providers = ensured.providers;

    if (!model) {
      configState.providers = applyCredentialsWithoutModel(configState.providers, provider);
    } else {
      configState.providers = applyActiveProvider(configState.providers, {
        providerId: provider,
        model,
        hasApiKey: true,
      });
    }

    persistConfig();
    return ok(getActiveProvider() ?? { ...ensured.entry });
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

    configState.providers = applyActiveProvider(configState.providers, {
      providerId: provider,
      model,
      preserveModel: true,
    });

    persistConfig();
    return getActiveProvider();
  };

  const deleteProviderCredentials = (
    providerId: AIProvider,
  ): Result<boolean, SecretsStorageError> => {
    const providerExists = configState.providers.some(
      (item) => item.provider === providerId,
    );
    let hadSecret = false;

    if (isFileStorage(configState)) {
      hadSecret = fileHasSecret(secretsState, providerId);
      if (hadSecret) {
        delete secretsState.providers[providerId];
      }
      persistFileSecrets();
    } else {
      const deleteResult = deleteKeyringSecret(getApiKeyName(providerId));
      if (!deleteResult.ok) return deleteResult;
      hadSecret = deleteResult.value;
      if (fileHasSecret(secretsState, providerId)) {
        delete secretsState.providers[providerId];
        persistFileSecrets();
      }
    }

    configState.providers = clearProviderCredentials(configState.providers, providerId);
    persistConfig();
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

// Lazy singleton — avoids filesystem reads at import time
let _store: ConfigStore | null = null;
function getStore(): ConfigStore {
  if (!_store) _store = createConfigStore();
  return _store;
}

export const getSettings: ConfigStore["getSettings"] = (...args) => getStore().getSettings(...args);
export const updateSettings: ConfigStore["updateSettings"] = (...args) => getStore().updateSettings(...args);
export const getProviders: ConfigStore["getProviders"] = (...args) => getStore().getProviders(...args);
export const getActiveProvider: ConfigStore["getActiveProvider"] = (...args) => getStore().getActiveProvider(...args);
export const getProviderApiKey: ConfigStore["getProviderApiKey"] = (...args) => getStore().getProviderApiKey(...args);
export const getProjectInfo: ConfigStore["getProjectInfo"] = (...args) => getStore().getProjectInfo(...args);
export const getTrust: ConfigStore["getTrust"] = (...args) => getStore().getTrust(...args);
export const listTrustedProjects: ConfigStore["listTrustedProjects"] = (...args) => getStore().listTrustedProjects(...args);
export const saveTrust: ConfigStore["saveTrust"] = (...args) => getStore().saveTrust(...args);
export const removeTrust: ConfigStore["removeTrust"] = (...args) => getStore().removeTrust(...args);
export const saveProviderCredentials: ConfigStore["saveProviderCredentials"] = (...args) => getStore().saveProviderCredentials(...args);
export const activateProvider: ConfigStore["activateProvider"] = (...args) => getStore().activateProvider(...args);
export const deleteProviderCredentials: ConfigStore["deleteProviderCredentials"] = (...args) => getStore().deleteProviderCredentials(...args);
