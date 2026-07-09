import { createError, getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type {
  AIProvider,
  CredentialRef,
  ProjectInfo,
  ProviderStatus,
  SecretsStorage,
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
  persistConfigMergedAsync,
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
  findOrphanedKeyringEntries,
  getApiKeyName,
  migrateSecretsStorage,
  reconcileKeyringSecrets,
  rollbackKeyringWrites,
} from "./secrets-migration.js";
import { resolveSecretEntry, toSecretEntry } from "./secrets-store.js";
import { createMutex, runConfigTransaction } from "./transaction.js";
import { createTrustStore, type TrustStore } from "./trust-store.js";
import type {
  ConfigState,
  SecretsState,
  SecretsStorageError,
  SecretsStorageErrorCode,
} from "./types.js";

// Re-keys review history on a project move (F-447). `shared/` must not import
// `features/`, so the review feature registers its implementation here at startup;
// defaults to a no-op.
type ReviewRekeyHandler = (oldProjectPath: string, newProjectPath: string) => void;
let reviewRekeyHandler: ReviewRekeyHandler = () => {};

export function setReviewRekeyHandler(handler: ReviewRekeyHandler): void {
  reviewRekeyHandler = handler;
}

// Log the raw cause (which carries the absolute path) server-side and return a
// path-free message so API clients never receive host paths or filenames (F-085).
const persistFailure = (operation: "config" | "secrets", cause: unknown): SecretsStorageError => {
  log("error", "config_persist_failed", { operation, error: getErrorMessage(cause) });
  return createError<SecretsStorageErrorCode>("PERSIST_FAILED", `Failed to persist ${operation}`);
};

// Delete keyring entries shadowed by an env sidecar ref (F-105): reads resolve the
// sidecar env ref first, so a stale `api_key_<provider>` from an interrupted literal->env
// switch would linger unreferenced. Keyring mode only, probing env-sidecar providers.
const deleteShadowedKeyringEntries = (secrets: SecretsState): void => {
  for (const [providerId, entry] of Object.entries(secrets.providers)) {
    if (typeof entry === "string" || entry.kind !== "env") continue;
    const existing = readKeyringSecret(getApiKeyName(providerId));
    if (!existing.ok) {
      log("warn", "keyring_shadow_reconcile_failed", {
        providerId,
        error: existing.error.message,
      });
      continue;
    }
    if (existing.value === null) continue;
    const deleteResult = deleteKeyringSecret(getApiKeyName(providerId));
    if (!deleteResult.ok) {
      log("warn", "keyring_shadow_delete_failed", {
        providerId,
        error: deleteResult.error.message,
      });
    }
  }
};

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

// config and secrets state stay inline (not extracted like trust): they are one shared
// mutable aggregate that updateSettings and the provider-credential methods both mutate
// through the same mtime-guarded persist wrappers, so splitting them would just thread
// mutable state across module boundaries.
export function createConfigStore(): ConfigStore {
  let configState: ConfigState = loadConfig();
  let secretsState: SecretsState = loadSecrets();
  const trustStore: TrustStore = createTrustStore();

  let configMtimeMs: number | null = getFileMtimeMs(getGlobalConfigPath());
  let secretsMtimeMs: number | null = getFileMtimeMs(getGlobalSecretsPath());

  // Serialize config/secrets mutations so concurrent API calls never interleave at
  // their await points and each observes the previous mutation's settled state (F-167).
  const mutex = createMutex();

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
    ...(state.unknownProviders ? { unknownProviders: state.unknownProviders } : {}),
    ...(state.unknownSettings ? { unknownSettings: state.unknownSettings } : {}),
  });

  const cloneSecretsState = (state: SecretsState): SecretsState => ({
    providers: Object.fromEntries(
      Object.entries(state.providers).map(([providerId, entry]) => [
        providerId,
        typeof entry === "string" ? entry : { ...entry },
      ]),
    ),
    ...(state.unknownSecrets ? { unknownSecrets: state.unknownSecrets } : {}),
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

  // Pre-mutation snapshot persistConfig diffs against to tell which providers/settings
  // THIS instance changed (overwrite disk) from those it left untouched (yield to a
  // concurrent instance's write) — F-359.
  let providersBeforeMutation: ProviderStatus[] = configState.providers.map((p) => ({ ...p }));
  let settingsBeforeMutation: SettingsConfig = { ...configState.settings };

  const persistConfig = async (): Promise<Result<void, SecretsStorageError>> => {
    try {
      // Merge at per-provider and per-settings-field granularity so a change another
      // instance persisted during this window is not erased by this instance's full
      // provider array or stale settings object.
      await persistConfigMergedAsync(configState, providersBeforeMutation, settingsBeforeMutation);
      configMtimeMs = getFileMtimeMs(getGlobalConfigPath());
      return ok(undefined);
    } catch (cause) {
      return err(persistFailure("config", cause));
    }
  };

  const persistFileSecrets = async (): Promise<Result<void, SecretsStorageError>> => {
    try {
      const hasUnknownSecrets = Object.keys(secretsState.unknownSecrets ?? {}).length > 0;
      if (Object.keys(secretsState.providers).length === 0 && !hasUnknownSecrets) {
        removeSecretsFile();
        secretsMtimeMs = getFileMtimeMs(getGlobalSecretsPath());
        return ok(undefined);
      }

      await persistSecretsAsync(secretsState);
      secretsMtimeMs = getFileMtimeMs(getGlobalSecretsPath());
      return ok(undefined);
    } catch (cause) {
      return err(persistFailure("secrets", cause));
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

  // Called at each mutation's snapshot point (after disk refresh, before mutation) to
  // record the pre-mutation state persistConfig later merges against (F-359).
  const markConfigBeforeMutation = (): void => {
    providersBeforeMutation = configState.providers.map((p) => ({ ...p }));
    settingsBeforeMutation = { ...configState.settings };
  };

  // Config-only mutations (settings, provider activation): refresh → snapshot → mutate
  // → persist → restore the snapshot if the disk write fails.
  const configTransactionDeps = {
    refresh: refreshConfigState,
    snapshot: () => {
      markConfigBeforeMutation();
      return cloneConfigState(configState);
    },
    restore: (backup: ConfigState) => {
      configState = backup;
    },
    persist: persistConfig,
  };

  // Complete an interrupted secrets-storage migration (crash between the config write
  // and the file/keyring cleanup, F-449). Keyring mode: move stranded secrets.json
  // literals into the keyring and rewrite the file without them. File mode: delete
  // orphaned keyring entries. Best-effort — a keyring failure leaves state intact.
  const startupStorage = effectiveStorage(configState);
  if (startupStorage === "keyring") {
    const reconciled = reconcileKeyringSecrets(secretsState);
    if (!reconciled.ok) {
      log("warn", "secrets_reconcile_failed", { error: reconciled.error.message });
    } else if (reconciled.value) {
      secretsState = reconciled.value.nextSecrets;
      void persistFileSecrets().then((result) => {
        if (!result.ok) {
          log("warn", "secrets_reconcile_persist_failed", { error: result.error.message });
        }
      });
      log("info", "secrets_reconciled", { migrated: reconciled.value.migrated.join(",") });
    }
    deleteShadowedKeyringEntries(secretsState);
  } else if (startupStorage === "file") {
    const orphans = findOrphanedKeyringEntries(configState);
    if (!orphans.ok) {
      log("warn", "keyring_reconcile_failed", { error: orphans.error.message });
    } else if (orphans.value.length > 0) {
      finalizeKeyringDeletions(orphans.value);
      log("info", "keyring_reconciled", { deleted: orphans.value.join(",") });
    }
  }

  const getSettings = (): SettingsConfig => {
    refreshConfigState();
    return { ...configState.settings };
  };

  const migrateStorage = async (
    nextSettings: SettingsConfig,
    currentStorage: SecretsStorage,
    nextStorage: SecretsStorage,
  ): Promise<Result<SettingsConfig, SecretsStorageError>> => {
    refreshSecretsState();
    const migrateResult = migrateSecretsStorage(
      configState,
      secretsState,
      currentStorage,
      nextStorage,
    );
    if (!migrateResult.ok) return migrateResult;

    markConfigBeforeMutation();
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

    return ok({ ...configState.settings });
  };

  const updateSettings = (
    patch: Partial<SettingsConfig>,
  ): Promise<Result<SettingsConfig, SecretsStorageError>> =>
    mutex.run(async () => {
      refreshConfigState();

      const nextSettings: SettingsConfig = {
        ...configState.settings,
        ...patch,
      };

      const currentStorage = effectiveStorage(configState);
      const nextStorage = nextSettings.secretsStorage;

      if (currentStorage !== null && nextStorage !== null && currentStorage !== nextStorage) {
        return migrateStorage(nextSettings, currentStorage, nextStorage);
      }

      return runConfigTransaction(configTransactionDeps, () => {
        configState.settings = nextSettings;
        return ok({ ...configState.settings });
      });
    });

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

  const onProjectMove = (oldRepoRoot: string, newRepoRoot: string): void => {
    reviewRekeyHandler(oldRepoRoot, newRepoRoot);
  };

  const getProjectInfo = (projectRoot?: string): ProjectInfo => {
    const resolvedRoot = resolveRoot(projectRoot);
    const projectFile = readProjectFile(resolvedRoot, { onMove: onProjectMove });

    return {
      path: resolvedRoot,
      projectId: projectFile?.projectId ?? null,
      trust: projectFile ? trustStore.getTrust(projectFile.projectId) : null,
    };
  };

  const ensureProjectFile = (projectRoot: string): ProjectInfo => {
    const resolvedRoot = resolveRoot(projectRoot);
    const projectFile = createProjectFile(resolvedRoot, { onMove: onProjectMove });

    return {
      path: resolvedRoot,
      projectId: projectFile.projectId,
      trust: trustStore.getTrust(projectFile.projectId),
    };
  };

  const saveProviderCredentials = (input: {
    provider: AIProvider;
    apiKey: string | CredentialRef;
    model?: string;
  }): Promise<Result<ProviderStatus, SecretsStorageError>> =>
    mutex.run(async () => {
      refreshConfigState();
      refreshSecretsState();
      if (!isStorageConfigured(configState)) {
        return err(
          createError(
            "STORAGE_NOT_CONFIGURED",
            "Secrets storage backend must be configured before saving credentials",
          ),
        );
      }

      const { provider, apiKey, model } = input;
      const { entry, resolvedValue } = toSecretEntry(apiKey, provider);
      markConfigBeforeMutation();
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
          // Switching to an env credential must delete this provider's keyring literal,
          // or the sidecar env ref (resolved first on read) leaves it shadowed (F-105).
          // Capture for rollback, persist the sidecar, then delete — a crash between is
          // repaired at startup.
          const previousKeyringResult = readKeyringSecret(getApiKeyName(provider));
          if (!previousKeyringResult.ok) return previousKeyringResult;
          previousKeyringValue = previousKeyringResult.value;

          secretsState.providers[provider] = entry;
          const secretsResult = await persistFileSecrets();
          if (!secretsResult.ok) {
            secretsState = secretsBackup;
            return secretsResult;
          }

          if (previousKeyringValue !== null) {
            const deleteResult = deleteKeyringSecret(getApiKeyName(provider));
            if (!deleteResult.ok) {
              await restoreSecretsState(secretsBackup);
              return deleteResult;
            }
            touchedKeyring = true;
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
    });

  const activateProvider = (input: {
    provider: AIProvider;
    model?: string;
  }): Promise<Result<ProviderStatus | null, SecretsStorageError>> =>
    mutex.run(() =>
      runConfigTransaction(configTransactionDeps, () => {
        const { provider, model } = input;
        const existing = configState.providers.find((item) => item.provider === provider);
        if (!existing) return ok(null);
        if (!model && !existing.model) return ok(null);

        configState.providers = applyActiveProvider(configState.providers, {
          providerId: provider,
          model,
          preserveModel: true,
        });

        return ok(activeProvider(configState));
      }),
    );

  const deleteProviderCredentials = (
    providerId: AIProvider,
  ): Promise<Result<boolean, SecretsStorageError>> =>
    mutex.run(async () => {
      refreshConfigState();
      refreshSecretsState();
      if (!isStorageConfigured(configState)) {
        return err(
          createError(
            "STORAGE_NOT_CONFIGURED",
            "Secrets storage backend must be configured before deleting credentials",
          ),
        );
      }

      const providerExists = configState.providers.some((item) => item.provider === providerId);
      markConfigBeforeMutation();
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
    });

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

// Lazy singleton — avoids filesystem reads at import time.
let _store: ConfigStore | null = null;

export function getStore(): ConfigStore {
  if (!_store) _store = createConfigStore();
  return _store;
}
