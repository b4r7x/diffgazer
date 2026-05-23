import { resolveProjectRoot } from "../paths.js";
import { type Result, ok, err } from "@diffgazer/core/result";
import { getErrorMessage } from "@diffgazer/core/errors";
import type {
  AIProvider,
  CredentialRef,
  ProjectInfo,
  ProviderStatus,
  SettingsConfig,
  TrustConfig,
} from "@diffgazer/core/schemas/config";
import { PROVIDER_ENV_VARS } from "@diffgazer/core/schemas/config";
import type {
  ConfigState,
  SecretEntry,
  SecretsState,
  SecretsStorageError,
  SecretsStorageErrorCode,
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
  persistConfig as persistConfigSync_,
  persistConfigAsync,
  persistSecrets,
  persistSecretsAsync,
  persistTrustAsync,
  readProjectFile,
  createProjectFile,
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
  isStorageConfigured,
} from "./providers-state.js";
import {
  finalizeKeyringDeletions,
  getApiKeyName,
  migrateSecretsStorage,
} from "./secrets-migration.js";
import { getFileMtimeMs } from "../fs.js";
import {
  getGlobalConfigPath,
  getGlobalSecretsPath,
  getGlobalTrustPath,
} from "../paths.js";

/** Normalize a credential input (string or CredentialRef) into a SecretEntry for persistence. */
function toSecretEntry(
  apiKey: string | CredentialRef,
  providerId: AIProvider,
): { entry: SecretEntry; resolvedValue: string | null } {
  if (typeof apiKey === "string") {
    // Migrate legacy "env" sentinel strings
    if (apiKey === "env") {
      const varName = PROVIDER_ENV_VARS[providerId];
      return {
        entry: { kind: "env", varName },
        resolvedValue: process.env[varName] ?? null,
      };
    }
    return { entry: apiKey, resolvedValue: apiKey };
  }
  if (apiKey.kind === "env") {
    return {
      entry: { kind: "env", varName: apiKey.varName },
      resolvedValue: process.env[apiKey.varName] ?? null,
    };
  }
  return { entry: apiKey.value, resolvedValue: apiKey.value };
}

/** Resolve a secret entry to its runtime value. */
function resolveSecretEntry(entry: SecretEntry): string | null {
  if (typeof entry === "string") return entry;
  if (entry.kind === "env") return process.env[entry.varName] ?? null;
  return null;
}

function persistError(operation: string, cause: unknown): SecretsStorageError {
  return {
    code: "PERSIST_FAILED" as SecretsStorageErrorCode,
    message: `Failed to persist ${operation}: ${getErrorMessage(cause)}`,
  };
}

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

export function createConfigStore(): ConfigStore {
  let configState: ConfigState = loadConfig();
  let secretsState: SecretsState = loadSecrets();
  let trustState: TrustState = loadTrust();
  const sessionTrust: Record<string, TrustConfig> = {};

  let configMtimeMs: number | null = getFileMtimeMs(getGlobalConfigPath());
  let trustMtimeMs: number | null = getFileMtimeMs(getGlobalTrustPath());
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

  const persistTrust = async (
    failOnConflict: boolean = false,
  ): Promise<Result<void, SecretsStorageError>> => {
    const currentMtime = getFileMtimeMs(getGlobalTrustPath());
    if (trustMtimeMs !== null && currentMtime !== null && currentMtime !== trustMtimeMs) {
      if (failOnConflict) {
        return err({
          code: "CONCURRENCY_CONFLICT" as SecretsStorageErrorCode,
          message: "Trust file was modified concurrently; operation rejected for safety",
        });
      }
      const diskTrust = loadTrust();
      trustState = {
        projects: { ...diskTrust.projects, ...trustState.projects },
      };
    }
    try {
      await persistTrustAsync(trustState);
      trustMtimeMs = getFileMtimeMs(getGlobalTrustPath());
      return ok(undefined);
    } catch (cause) {
      return err(persistError("trust", cause));
    }
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
    const trust = projectFile
      ? sessionTrust[projectFile.projectId] ?? trustState.projects[projectFile.projectId] ?? null
      : null;

    return {
      path: resolvedRoot,
      projectId: projectFile?.projectId ?? null,
      trust,
    };
  };

  const ensureProjectFile = (projectRoot: string): ProjectInfo => {
    const resolvedRoot = resolveRoot(projectRoot);
    const projectFile = createProjectFile(resolvedRoot);
    const trust = sessionTrust[projectFile.projectId] ?? trustState.projects[projectFile.projectId] ?? null;

    return {
      path: resolvedRoot,
      projectId: projectFile.projectId,
      trust,
    };
  };

  const getTrust = (projectId: string): TrustConfig | null =>
    sessionTrust[projectId] ?? trustState.projects[projectId] ?? null;

  const listTrustedProjects = (): TrustConfig[] =>
    Object.values({ ...trustState.projects, ...sessionTrust });

  const saveTrust = async (
    config: TrustConfig,
  ): Promise<Result<TrustConfig, SecretsStorageError>> => {
    if (config.trustMode === "session") {
      sessionTrust[config.projectId] = config;
      return ok(config);
    }
    trustState.projects[config.projectId] = config;
    const result = await persistTrust(false);
    if (!result.ok) {
      delete trustState.projects[config.projectId];
      return result;
    }
    return ok(config);
  };

  const removeTrust = async (
    projectId: string,
  ): Promise<Result<boolean, SecretsStorageError>> => {
    const inSession = projectId in sessionTrust;
    const inPersistent = projectId in trustState.projects;
    if (!inSession && !inPersistent) return ok(false);
    if (inSession) delete sessionTrust[projectId];
    if (inPersistent) {
      const backup = trustState.projects[projectId];
      delete trustState.projects[projectId];
      const result = await persistTrust(true);
      if (!result.ok) {
        trustState.projects[projectId] = backup!;
        return result;
      }
    }
    return ok(true);
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
export const ensureProjectFile: ConfigStore["ensureProjectFile"] = (...args) => getStore().ensureProjectFile(...args);
export const getTrust: ConfigStore["getTrust"] = (...args) => getStore().getTrust(...args);
export const listTrustedProjects: ConfigStore["listTrustedProjects"] = (...args) => getStore().listTrustedProjects(...args);
export const saveTrust: ConfigStore["saveTrust"] = (...args) => getStore().saveTrust(...args);
export const removeTrust: ConfigStore["removeTrust"] = (...args) => getStore().removeTrust(...args);
export const saveProviderCredentials: ConfigStore["saveProviderCredentials"] = (...args) => getStore().saveProviderCredentials(...args);
export const activateProvider: ConfigStore["activateProvider"] = (...args) => getStore().activateProvider(...args);
export const deleteProviderCredentials: ConfigStore["deleteProviderCredentials"] = (...args) => getStore().deleteProviderCredentials(...args);
