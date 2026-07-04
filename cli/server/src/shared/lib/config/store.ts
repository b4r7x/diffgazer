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
import { persistError, resolveSecretEntry, toSecretEntry } from "./secrets-store.js";
import { createMutex, runConfigTransaction } from "./transaction.js";
import { createTrustStore, type TrustStore } from "./trust-store.js";
import type { ConfigState, SecretsState, SecretsStorageError } from "./types.js";

/**
 * Re-keys persisted review history from one project path to another when a
 * trusted repository directory is moved (F-447). The real implementation lives
 * in the review storage feature; `shared/` must not import `features/`, so the
 * feature registers it here at startup. Defaults to a no-op so the config store
 * works in isolation (and in tests that do not exercise review re-keying).
 */
type ReviewRekeyHandler = (oldProjectPath: string, newProjectPath: string) => void;
let reviewRekeyHandler: ReviewRekeyHandler = () => {};

export function setReviewRekeyHandler(handler: ReviewRekeyHandler): void {
  reviewRekeyHandler = handler;
}

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

  // Serializes config/secrets mutations so two concurrent API calls never
  // interleave at their await points (F-167) and each one observes the settled
  // state of the previous mutation.
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

  // The provider entries and settings as they stood before the current mutation,
  // captured at transaction snapshot time. persistConfig diffs against these to
  // tell which providers/settings fields THIS instance changed (overwrite disk)
  // from those it left untouched (yield to a concurrent instance's disk write) —
  // F-359.
  let providersBeforeMutation: ProviderStatus[] = configState.providers.map((p) => ({ ...p }));
  let settingsBeforeMutation: SettingsConfig = { ...configState.settings };

  const persistConfig = async (): Promise<Result<void, SecretsStorageError>> => {
    try {
      // Merge at write time at per-provider and per-settings-field granularity so
      // a change another instance persisted during this window — a known provider,
      // an id only it knows, or a different settings field — is not erased by this
      // instance's full provider array or stale settings object.
      await persistConfigMergedAsync(configState, providersBeforeMutation, settingsBeforeMutation);
      configMtimeMs = getFileMtimeMs(getGlobalConfigPath());
      return ok(undefined);
    } catch (cause) {
      return err(persistError("config", cause));
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

  // Records the pre-mutation provider entries and settings so the next
  // persistConfig can merge at per-provider and per-settings-field granularity
  // (F-359). Called at each mutation's snapshot point, after the disk refresh and
  // before configState is mutated.
  const markConfigBeforeMutation = (): void => {
    providersBeforeMutation = configState.providers.map((p) => ({ ...p }));
    settingsBeforeMutation = { ...configState.settings };
  };

  // Transaction discipline for config-only mutations (settings, provider
  // activation): refresh from disk → snapshot for rollback → mutate → persist
  // config → restore the snapshot if the disk write fails.
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

  // Complete an interrupted secrets-storage migration left by a crash between the
  // config write and the file/keyring cleanup (F-449). In keyring mode, move any
  // literal entries still in secrets.json into the keyring and rewrite the file
  // without them so the keyring becomes the single credential source as the docs
  // promise. In file mode, delete any orphaned keyring entries left when the
  // keyring→file copy persisted but the keyring deletion never ran, so the file
  // stays the single credential source. Best-effort: a keyring failure leaves the
  // existing state intact and readable.
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

// Lazy singleton — avoids filesystem reads at import time. Safe as a single
// instance because Node's event loop is single-threaded, so there is no
// concurrent first-call race to guard against.
let _store: ConfigStore | null = null;

export function getStore(): ConfigStore {
  if (!_store) _store = createConfigStore();
  return _store;
}
