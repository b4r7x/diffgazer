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
import {
  deleteKeyringSecret,
  readKeyringSecret,
  writeKeyringSecret,
} from "./keyring.js";
import {
  createProjectFile,
  loadConfig,
  loadSecrets,
  persistConfigAsync,
  persistConfig as persistConfigSync_,
  persistSecrets,
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
  updateSettings(patch: Partial<SettingsConfig>): Promise<Result<SettingsConfig, SecretsStorageError>>;
  getProviders(): ProviderStatus[];
  getActiveProvider(): ProviderStatus | null;
  getProviderApiKey(providerId: string): Result<string | null, SecretsStorageError>;
  getProjectInfo(projectRoot?: string): ProjectInfo;
  ensureProjectFile(projectRoot: string): ProjectInfo;
  getTrust(projectId: string): TrustConfig | null;
  listTrustedProjects(): TrustConfig[];
  saveTrust(config: TrustConfig): Promise<Result<TrustConfig, SecretsStorageError>>;
  removeTrust(projectId: string): Promise<Result<boolean, SecretsStorageError>>;
  saveProviderCredentials(input: { provider: AIProvider; apiKey: string | CredentialRef; model?: string }): Promise<Result<ProviderStatus, SecretsStorageError>>;
  activateProvider(input: { provider: AIProvider; model?: string }): Promise<Result<ProviderStatus | null, SecretsStorageError>>;
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

  const persistConfig = async (): Promise<Result<void, SecretsStorageError>> => {
    const currentMtime = getFileMtimeMs(getGlobalConfigPath());
    if (configMtimeMs !== null && currentMtime !== null && currentMtime !== configMtimeMs) {
      const diskState = loadConfig();
      configState = {
        settings: { ...diskState.settings, ...configState.settings },
        providers: configState.providers,
      };
    }
    try {
      await persistConfigAsync(configState);
      configMtimeMs = getFileMtimeMs(getGlobalConfigPath());
      return ok(undefined);
    } catch (cause) {
      return err(persistError("config", cause));
    }
  };

  const persistConfigSync = (): void => {
    persistConfigSync_(configState);
    configMtimeMs = getFileMtimeMs(getGlobalConfigPath());
  };

  const persistFileSecrets = async (): Promise<Result<void, SecretsStorageError>> => {
    if (Object.keys(secretsState.providers).length === 0) {
      removeSecretsFile();
      secretsMtimeMs = null;
      return ok(undefined);
    }

    const currentMtime = getFileMtimeMs(getGlobalSecretsPath());
    if (secretsMtimeMs !== null && currentMtime !== null && currentMtime !== secretsMtimeMs) {
      const diskSecrets = loadSecrets();
      secretsState = {
        providers: { ...diskSecrets.providers, ...secretsState.providers },
      };
    }

    try {
      await persistSecretsAsync(secretsState);
      secretsMtimeMs = getFileMtimeMs(getGlobalSecretsPath());
      return ok(undefined);
    } catch (cause) {
      return err(persistError("secrets", cause));
    }
  };

  const persistFileSecretsSync = (): void => {
    if (Object.keys(secretsState.providers).length === 0) {
      removeSecretsFile();
      secretsMtimeMs = null;
      return;
    }
    persistSecrets(secretsState);
    secretsMtimeMs = getFileMtimeMs(getGlobalSecretsPath());
  };

  const getSettings = (): SettingsConfig => ({ ...configState.settings });

  const updateSettings = async (
    patch: Partial<SettingsConfig>,
  ): Promise<Result<SettingsConfig, SecretsStorageError>> => {
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

      // Two-phase migration (crash-safe):
      // 1. Persist config with new storage setting FIRST so a crash recovery
      //    knows which backend is authoritative.
      configState.settings = nextSettings;
      persistConfigSync();

      // 2. Write secrets to the new storage backend.
      secretsState = migrateResult.value.nextSecrets;
      if (nextStorage === "file") {
        persistFileSecretsSync();
        configState.providers = syncProvidersWithSecrets(
          configState.providers,
          secretsState,
          nextStorage,
        );
      }

      // 3. Delete from old storage (safe: new storage already persisted).
      if (migrateResult.value.keyringDeletions.length > 0) {
        finalizeKeyringDeletions(migrateResult.value.keyringDeletions);
      }
      if (migrateResult.value.shouldDeleteSecretsFile) {
        try {
          removeSecretsFile();
        } catch (error) {
          // Non-fatal: the new backend already holds the secrets; a stale file
          // is cleaned up on next migration. Surface it via the structured log.
          log("warn", "secrets_file_cleanup_failed", { error: getErrorMessage(error) });
        }
      }

      return ok(getSettings());
    }

    configState.settings = nextSettings;
    const result = await persistConfig();
    if (!result.ok) return result;
    return ok(getSettings());
  };

  const getProviders = (): ProviderStatus[] =>
    configState.providers.map((provider) => ({ ...provider }));

  const getActiveProvider = (): ProviderStatus | null => activeProvider(configState);

  const getProviderApiKey = (
    providerId: string,
  ): Result<string | null, SecretsStorageError> => {
    if (!isStorageConfigured(configState)) {
      return ok(null);
    }
    if (isFileStorage(configState)) {
      const entry = secretsState.providers[providerId];
      if (entry === undefined) return ok(null);
      return ok(resolveSecretEntry(entry));
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
    if (!isStorageConfigured(configState)) {
      return err({
        code: "STORAGE_NOT_CONFIGURED" as SecretsStorageErrorCode,
        message: "Secrets storage backend must be configured before saving credentials",
      });
    }

    const { provider, apiKey, model } = input;
    const { entry, resolvedValue } = toSecretEntry(apiKey, provider);

    if (isFileStorage(configState)) {
      secretsState.providers[provider] = entry;
      const secretsResult = await persistFileSecrets();
      if (!secretsResult.ok) return secretsResult;
    } else {
      // For keyring storage, env refs are stored in the file (not keyring),
      // literal values go to keyring.
      if (typeof entry !== "string" && entry.kind === "env") {
        secretsState.providers[provider] = entry;
        const secretsResult = await persistFileSecrets();
        if (!secretsResult.ok) return secretsResult;
      } else {
        const keyValue = resolvedValue ?? (typeof entry === "string" ? entry : "");
        const writeResult = writeKeyringSecret(getApiKeyName(provider), keyValue);
        if (!writeResult.ok) return writeResult;
        if (fileHasSecret(secretsState, provider)) {
          delete secretsState.providers[provider];
          const secretsResult = await persistFileSecrets();
          if (!secretsResult.ok) return secretsResult;
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
    if (!configResult.ok) return configResult;
    return ok(getActiveProvider() ?? { ...ensured.entry });
  };

  const activateProvider = async (input: {
    provider: AIProvider;
    model?: string;
  }): Promise<Result<ProviderStatus | null, SecretsStorageError>> => {
    const { provider, model } = input;
    const existing = configState.providers.find(
      (item) => item.provider === provider,
    );
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
    if (!isStorageConfigured(configState)) {
      return err({
        code: "STORAGE_NOT_CONFIGURED" as SecretsStorageErrorCode,
        message: "Secrets storage backend must be configured before deleting credentials",
      });
    }

    const providerExists = configState.providers.some(
      (item) => item.provider === providerId,
    );
    let hadSecret = false;

    if (isFileStorage(configState)) {
      hadSecret = fileHasSecret(secretsState, providerId);
      if (hadSecret) {
        delete secretsState.providers[providerId];
      }
      const secretsResult = await persistFileSecrets();
      if (!secretsResult.ok) return secretsResult;
    } else {
      const deleteResult = deleteKeyringSecret(getApiKeyName(providerId));
      if (!deleteResult.ok) return deleteResult;
      hadSecret = deleteResult.value;
      if (fileHasSecret(secretsState, providerId)) {
        delete secretsState.providers[providerId];
        const secretsResult = await persistFileSecrets();
        if (!secretsResult.ok) return secretsResult;
      }
    }

    configState.providers = clearProviderCredentials(configState.providers, providerId);
    const configResult = await persistConfig();
    if (!configResult.ok) return configResult;
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
