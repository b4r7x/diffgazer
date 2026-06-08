import { getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type {
  AIProvider,
  CredentialRef,
  ProjectInfo,
  ProviderStatus,
  SettingsConfig,
  TrustConfig,
} from "@diffgazer/core/schemas/config";
import { getFileMtimeMs } from "../fs.js";
import { log } from "../log.js";
import { getGlobalConfigPath, getGlobalSecretsPath, resolveProjectRoot } from "../paths.js";
import { deleteKeyringSecret, readKeyringSecret, writeKeyringSecret } from "./keyring.js";
import {
  createProjectFile,
  loadConfig,
  loadSecrets,
  persistConfigAsync,
  persistSecretsAsync,
  readProjectFile,
  removeSecretsFile,
  syncProvidersWithSecrets,
} from "./persistence.js";
import {
  activeProvider,
  applyActiveProvider,
  applyCredentialsWithoutModel,
  clearProviderCredentials,
  effectiveStorage,
  ensureProviderEntry,
  fileHasSecret,
  isFileStorage,
  isStorageConfigured,
} from "./providers-store.js";
import {
  finalizeKeyringDeletions,
  getApiKeyName,
  migrateSecretsStorage,
  rollbackKeyringWrites,
} from "./secrets-migration.js";
import { persistError, resolveSecretEntry, toSecretEntry } from "./secrets-store.js";
import { createTrustStore, type TrustStore } from "./trust-store.js";
import type {
  ConfigState,
  SecretsState,
  SecretsStorageError,
  SecretsStorageErrorCode,
} from "./types.js";

export interface ConfigStore {
  getSettings(): SettingsConfig;
  updateSettings(
    patch: Partial<SettingsConfig>,
  ): Promise<Result<SettingsConfig, SecretsStorageError>>;
  getProviders(): ProviderStatus[];
  getActiveProvider(): ProviderStatus | null;
  getProviderApiKey(providerId: string): Result<string | null, SecretsStorageError>;
  getProjectInfo(projectRoot?: string): ProjectInfo;
  ensureProjectFile(projectRoot: string): ProjectInfo;
  getTrust(projectId: string): TrustConfig | null;
  listTrustedProjects(): TrustConfig[];
  saveTrust(config: TrustConfig): Promise<Result<TrustConfig, SecretsStorageError>>;
  removeTrust(projectId: string): Promise<Result<boolean, SecretsStorageError>>;
  saveProviderCredentials(input: {
    provider: AIProvider;
    apiKey: string | CredentialRef;
    model?: string;
  }): Promise<Result<ProviderStatus, SecretsStorageError>>;
  activateProvider(input: {
    provider: AIProvider;
    model?: string;
  }): Promise<Result<ProviderStatus | null, SecretsStorageError>>;
  deleteProviderCredentials(providerId: AIProvider): Promise<Result<boolean, SecretsStorageError>>;
}

/**
 * Composes the config store from the stateless persistence/migration helpers
 * (`persistence.ts`, `providers-store.ts`, `secrets-migration.ts`, `secrets-store.ts`,
 * `keyring.ts`) and the one cleanly separable stateful slice, `trust-store.ts`.
 *
 * `config-persistence` and `providers-store` are deliberately retained inline
 * here rather than extracted. `configState` and `secretsState` are a single shared
 * mutable aggregate: `updateSettings` (storage migration) and the provider-
 * credential methods (`saveProviderCredentials`/`activateProvider`/
 * `deleteProviderCredentials`) both mutate `configState.providers` and
 * `secretsState.providers` and depend on the same mtime-guarded persist
 * wrappers. Splitting them into separate stateful factories would require
 * threading that mutable state across module boundaries as injected
 * dependencies, which leaks state and weakens SRP rather than improving it. The
 * only state slice that does not touch config/secrets — trust — was extracted.
 */
export function createConfigStore(): ConfigStore {
  let configState: ConfigState = loadConfig();
  let secretsState: SecretsState = loadSecrets();
  const trustStore: TrustStore = createTrustStore();

  let configMtimeMs: number | null = getFileMtimeMs(getGlobalConfigPath());
  let secretsMtimeMs: number | null = getFileMtimeMs(getGlobalSecretsPath());

  const initialStorage = effectiveStorage(configState);
  if (initialStorage !== null) {
    configState.providers = syncProvidersWithSecrets(
      configState.providers,
      secretsState,
      initialStorage,
    );
  }

  const cloneConfigState = (state: ConfigState): ConfigState => ({
    settings: { ...state.settings },
    providers: state.providers.map((provider) => ({ ...provider })),
  });

  const cloneSecretsState = (state: SecretsState): SecretsState => ({
    providers: Object.fromEntries(
      Object.entries(state.providers).map(([providerId, entry]) => [
        providerId,
        typeof entry === "string" ? entry : { ...entry },
      ]),
    ),
  });

  const syncLoadedProviders = (): void => {
    const storage = effectiveStorage(configState);
    if (storage === null) return;
    configState.providers = syncProvidersWithSecrets(configState.providers, secretsState, storage);
  };

  const refreshConfigState = (): void => {
    const currentMtime = getFileMtimeMs(getGlobalConfigPath());
    if (currentMtime === configMtimeMs) return;
    configState = loadConfig();
    configMtimeMs = currentMtime;
    syncLoadedProviders();
  };

  const refreshSecretsState = (): void => {
    const currentMtime = getFileMtimeMs(getGlobalSecretsPath());
    if (currentMtime === secretsMtimeMs) return;
    secretsState = loadSecrets();
    secretsMtimeMs = currentMtime;
    syncLoadedProviders();
  };

  const persistConfig = async (): Promise<Result<void, SecretsStorageError>> => {
    try {
      await persistConfigAsync(configState);
      configMtimeMs = getFileMtimeMs(getGlobalConfigPath());
      return ok(undefined);
    } catch (cause) {
      return err(persistError("config", cause));
    }
  };

  const persistFileSecrets = async (): Promise<Result<void, SecretsStorageError>> => {
    try {
      if (Object.keys(secretsState.providers).length === 0) {
        removeSecretsFile();
        secretsMtimeMs = getFileMtimeMs(getGlobalSecretsPath());
        return ok(undefined);
      }

      await persistSecretsAsync(secretsState);
      secretsMtimeMs = getFileMtimeMs(getGlobalSecretsPath());
      return ok(undefined);
    } catch (cause) {
      return err(persistError("secrets", cause));
    }
  };

  const restoreSecretsState = async (backup: SecretsState): Promise<void> => {
    secretsState = cloneSecretsState(backup);
    const rollbackResult = await persistFileSecrets();
    if (!rollbackResult.ok) {
      log("warn", "secrets_rollback_failed", { error: rollbackResult.error.message });
    }
  };

  const restoreKeyringSecret = (providerId: string, previousValue: string | null): void => {
    const rollbackResult =
      previousValue === null
        ? deleteKeyringSecret(getApiKeyName(providerId))
        : writeKeyringSecret(getApiKeyName(providerId), previousValue);
    if (!rollbackResult.ok) {
      log("warn", "keyring_rollback_failed", {
        providerId,
        error: rollbackResult.error.message,
      });
    }
  };

  const getSettings = (): SettingsConfig => {
    refreshConfigState();
    return { ...configState.settings };
  };

  const updateSettings = async (
    patch: Partial<SettingsConfig>,
  ): Promise<Result<SettingsConfig, SecretsStorageError>> => {
    refreshConfigState();
    refreshSecretsState();

    const nextSettings: SettingsConfig = {
      ...configState.settings,
      ...patch,
    };

    const currentStorage = effectiveStorage(configState);
    const nextStorage = nextSettings.secretsStorage;

    if (currentStorage !== null && nextStorage !== null && currentStorage !== nextStorage) {
      const migrateResult = migrateSecretsStorage(
        configState,
        secretsState,
        currentStorage,
        nextStorage,
      );
      if (!migrateResult.ok) return migrateResult;

      const configBackup = cloneConfigState(configState);
      const secretsBackup = cloneSecretsState(secretsState);

      if (nextStorage === "keyring") {
        configState = {
          ...configState,
          settings: nextSettings,
        };
        const configResult = await persistConfig();
        if (!configResult.ok) {
          configState = configBackup;
          rollbackKeyringWrites(migrateResult.value.keyringWrites);
          return configResult;
        }

        secretsState = cloneSecretsState(migrateResult.value.nextSecrets);
        const secretsResult = await persistFileSecrets();
        if (!secretsResult.ok) {
          configState = configBackup;
          const rollbackConfigResult = await persistConfig();
          if (!rollbackConfigResult.ok) {
            log("warn", "config_rollback_failed", { error: rollbackConfigResult.error.message });
          }
          await restoreSecretsState(secretsBackup);
          rollbackKeyringWrites(migrateResult.value.keyringWrites);
          return secretsResult;
        }
      } else {
        secretsState = cloneSecretsState(migrateResult.value.nextSecrets);
        const secretsResult = await persistFileSecrets();
        if (!secretsResult.ok) {
          secretsState = secretsBackup;
          return secretsResult;
        }

        configState = {
          ...configState,
          settings: nextSettings,
        };
        configState.providers = syncProvidersWithSecrets(
          configState.providers,
          secretsState,
          nextStorage,
        );

        const configResult = await persistConfig();
        if (!configResult.ok) {
          configState = configBackup;
          await restoreSecretsState(secretsBackup);
          return configResult;
        }

        if (migrateResult.value.keyringDeletions.length > 0) {
          finalizeKeyringDeletions(migrateResult.value.keyringDeletions);
        }
      }

      if (migrateResult.value.shouldDeleteSecretsFile) {
        try {
          removeSecretsFile();
          secretsMtimeMs = getFileMtimeMs(getGlobalSecretsPath());
        } catch (error) {
          log("warn", "secrets_file_cleanup_failed", { error: getErrorMessage(error) });
        }
      }

      syncLoadedProviders();

      return ok(getSettings());
    }

    configState.settings = nextSettings;
    const result = await persistConfig();
    if (!result.ok) return result;
    return ok(getSettings());
  };

  const getProviders = (): ProviderStatus[] => {
    refreshConfigState();
    refreshSecretsState();
    return configState.providers.map((provider) => ({ ...provider }));
  };

  const getActiveProvider = (): ProviderStatus | null => {
    refreshConfigState();
    refreshSecretsState();
    return activeProvider(configState);
  };

  const getProviderApiKey = (providerId: string): Result<string | null, SecretsStorageError> => {
    refreshConfigState();
    refreshSecretsState();
    if (!isStorageConfigured(configState)) {
      return ok(null);
    }
    if (isFileStorage(configState)) {
      const entry = secretsState.providers[providerId];
      if (entry === undefined) return ok(null);
      return ok(resolveSecretEntry(entry));
    }
    const sidecarEntry = secretsState.providers[providerId];
    if (sidecarEntry !== undefined) {
      return ok(resolveSecretEntry(sidecarEntry));
    }
    return readKeyringSecret(getApiKeyName(providerId));
  };

  const resolveRoot = (projectRoot?: string): string =>
    resolveProjectRoot({
      header: projectRoot ?? null,
      env: process.env.DIFFGAZER_PROJECT_ROOT ?? null,
      cwd: process.cwd(),
    });

  const getProjectInfo = (projectRoot?: string): ProjectInfo => {
    const resolvedRoot = resolveRoot(projectRoot);
    const projectFile = readProjectFile(resolvedRoot);

    return {
      path: resolvedRoot,
      projectId: projectFile?.projectId ?? null,
      trust: projectFile ? trustStore.getTrust(projectFile.projectId) : null,
    };
  };

  const ensureProjectFile = (projectRoot: string): ProjectInfo => {
    const resolvedRoot = resolveRoot(projectRoot);
    const projectFile = createProjectFile(resolvedRoot);

    return {
      path: resolvedRoot,
      projectId: projectFile.projectId,
      trust: trustStore.getTrust(projectFile.projectId),
    };
  };

  const saveProviderCredentials = async (input: {
    provider: AIProvider;
    apiKey: string | CredentialRef;
    model?: string;
  }): Promise<Result<ProviderStatus, SecretsStorageError>> => {
    refreshConfigState();
    refreshSecretsState();
    if (!isStorageConfigured(configState)) {
      return err({
        code: "STORAGE_NOT_CONFIGURED" as SecretsStorageErrorCode,
        message: "Secrets storage backend must be configured before saving credentials",
      });
    }

    const { provider, apiKey, model } = input;
    const { entry, resolvedValue } = toSecretEntry(apiKey, provider);
    const configBackup = cloneConfigState(configState);
    const secretsBackup = cloneSecretsState(secretsState);
    let previousKeyringValue: string | null = null;
    let touchedKeyring = false;

    if (isFileStorage(configState)) {
      secretsState.providers[provider] = entry;
      const secretsResult = await persistFileSecrets();
      if (!secretsResult.ok) {
        secretsState = secretsBackup;
        return secretsResult;
      }
    } else {
      if (typeof entry !== "string" && entry.kind === "env") {
        secretsState.providers[provider] = entry;
        const secretsResult = await persistFileSecrets();
        if (!secretsResult.ok) {
          secretsState = secretsBackup;
          return secretsResult;
        }
      } else {
        const previousKeyringResult = readKeyringSecret(getApiKeyName(provider));
        if (!previousKeyringResult.ok) return previousKeyringResult;
        previousKeyringValue = previousKeyringResult.value;
        const keyValue = resolvedValue ?? (typeof entry === "string" ? entry : "");
        const writeResult = writeKeyringSecret(getApiKeyName(provider), keyValue);
        if (!writeResult.ok) return writeResult;
        touchedKeyring = true;
        if (fileHasSecret(secretsState, provider)) {
          delete secretsState.providers[provider];
          const secretsResult = await persistFileSecrets();
          if (!secretsResult.ok) {
            restoreKeyringSecret(provider, previousKeyringValue);
            await restoreSecretsState(secretsBackup);
            return secretsResult;
          }
        }
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

    const configResult = await persistConfig();
    if (!configResult.ok) {
      configState = configBackup;
      await restoreSecretsState(secretsBackup);
      if (touchedKeyring) {
        restoreKeyringSecret(provider, previousKeyringValue);
      }
      return configResult;
    }

    const savedProvider = configState.providers.find((item) => item.provider === provider);
    return ok(savedProvider ? { ...savedProvider } : { ...ensured.entry, hasApiKey: true });
  };

  const activateProvider = async (input: {
    provider: AIProvider;
    model?: string;
  }): Promise<Result<ProviderStatus | null, SecretsStorageError>> => {
    refreshConfigState();
    const { provider, model } = input;
    const existing = configState.providers.find((item) => item.provider === provider);
    if (!existing) return ok(null);
    if (!model && !existing.model) return ok(null);

    configState.providers = applyActiveProvider(configState.providers, {
      providerId: provider,
      model,
      preserveModel: true,
    });

    const result = await persistConfig();
    if (!result.ok) return result;
    return ok(getActiveProvider());
  };

  const deleteProviderCredentials = async (
    providerId: AIProvider,
  ): Promise<Result<boolean, SecretsStorageError>> => {
    refreshConfigState();
    refreshSecretsState();
    if (!isStorageConfigured(configState)) {
      return err({
        code: "STORAGE_NOT_CONFIGURED" as SecretsStorageErrorCode,
        message: "Secrets storage backend must be configured before deleting credentials",
      });
    }

    const providerExists = configState.providers.some((item) => item.provider === providerId);
    const configBackup = cloneConfigState(configState);
    const secretsBackup = cloneSecretsState(secretsState);
    let hadSecret = false;
    let previousKeyringValue: string | null = null;
    let touchedKeyring = false;

    if (isFileStorage(configState)) {
      hadSecret = fileHasSecret(secretsState, providerId);
      if (hadSecret) {
        delete secretsState.providers[providerId];
      }
      const secretsResult = await persistFileSecrets();
      if (!secretsResult.ok) {
        secretsState = secretsBackup;
        return secretsResult;
      }
    } else {
      const previousKeyringResult = readKeyringSecret(getApiKeyName(providerId));
      if (!previousKeyringResult.ok) return previousKeyringResult;
      previousKeyringValue = previousKeyringResult.value;
      if (previousKeyringValue !== null) {
        const deleteResult = deleteKeyringSecret(getApiKeyName(providerId));
        if (!deleteResult.ok) return deleteResult;
        hadSecret = deleteResult.value;
        touchedKeyring = deleteResult.value;
      }
      if (fileHasSecret(secretsState, providerId)) {
        delete secretsState.providers[providerId];
        const secretsResult = await persistFileSecrets();
        if (!secretsResult.ok) {
          if (touchedKeyring) {
            restoreKeyringSecret(providerId, previousKeyringValue);
          }
          await restoreSecretsState(secretsBackup);
          return secretsResult;
        }
        hadSecret = true;
      }
    }

    configState.providers = clearProviderCredentials(configState.providers, providerId);
    const configResult = await persistConfig();
    if (!configResult.ok) {
      configState = configBackup;
      await restoreSecretsState(secretsBackup);
      if (touchedKeyring) {
        restoreKeyringSecret(providerId, previousKeyringValue);
      }
      return configResult;
    }
    return ok(providerExists || hadSecret);
  };

  return {
    getSettings,
    updateSettings,
    getProviders,
    getActiveProvider,
    getProviderApiKey,
    getProjectInfo,
    ensureProjectFile,
    getTrust: trustStore.getTrust,
    listTrustedProjects: trustStore.listTrustedProjects,
    saveTrust: trustStore.saveTrust,
    removeTrust: trustStore.removeTrust,
    saveProviderCredentials,
    activateProvider,
    deleteProviderCredentials,
  };
}

// Lazy singleton — avoids filesystem reads at import time. Safe as a single
// instance because Node's event loop is single-threaded, so there is no
// concurrent first-call race to guard against.
let _store: ConfigStore | null = null;

export function getStore(): ConfigStore {
  if (!_store) _store = createConfigStore();
  return _store;
}
