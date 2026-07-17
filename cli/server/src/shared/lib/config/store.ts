import { isDeepStrictEqual } from "node:util";
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
import { z } from "zod";
import {
  getFileMtimeMs,
  readJsonFileSyncSafe,
  removeFileSync,
  writeJsonFile,
  writeJsonFileSync,
} from "../fs.js";
import { log } from "../log.js";
import { getGlobalConfigPath, getGlobalSecretsPath, resolveProjectRoot } from "../paths.js";
import { deleteKeyringSecret, readKeyringSecret, writeKeyringSecret } from "./keyring.js";
import {
  createProjectFile,
  loadConfig,
  loadSecrets,
  type PersistConfigMerged,
  parseConfigData,
  parseSecretsData,
  persistSecretsAsync,
  readProjectFile,
  syncProvidersWithSecrets,
  withConfigFileTransaction,
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
type ReviewRekeyHandler = (oldProjectPath: string, newProjectPath: string) => Promise<boolean>;
let reviewRekeyHandler: ReviewRekeyHandler = async () => true;

export function setReviewRekeyHandler(handler: ReviewRekeyHandler): void {
  reviewRekeyHandler = handler;
}

// Log the raw cause (which carries the absolute path) server-side and return a
// path-free message so API clients never receive host paths or filenames (F-085).
const persistFailure = (operation: "config" | "secrets", cause: unknown): SecretsStorageError => {
  log("error", "config_persist_failed", { operation, error: getErrorMessage(cause) });
  return createError<SecretsStorageErrorCode>("PERSIST_FAILED", `Failed to persist ${operation}`);
};

const SecretsRecoveryRecordSchema = z
  .object({
    version: z.literal(1),
    previousConfigFileExisted: z.boolean(),
    previousConfig: z.unknown(),
    previousFileExisted: z.boolean(),
    previousSecrets: z
      .object({
        providers: z.record(z.string(), z.unknown()),
      })
      .strict(),
  })
  .strict();

type SecretsRecoveryRecord = z.infer<typeof SecretsRecoveryRecordSchema>;

const getSecretsRecoveryPath = (): string => `${getGlobalSecretsPath()}.recovery`;

const serializeSecretsState = (state: SecretsState): SecretsRecoveryRecord["previousSecrets"] => ({
  providers: { ...state.unknownSecrets, ...state.providers },
});

const rollbackFailure = (cause: unknown): SecretsStorageError => {
  log("error", "secrets_rollback_failed", { error: getErrorMessage(cause) });
  return createError<SecretsStorageErrorCode>(
    "ROLLBACK_FAILED",
    "Failed to restore secrets after a partial persistence failure",
  );
};

const restoreRecoveryRecordSync = (record: SecretsRecoveryRecord): void => {
  if (record.previousConfigFileExisted) {
    writeJsonFileSync(getGlobalConfigPath(), record.previousConfig, 0o600);
  } else {
    removeFileSync(getGlobalConfigPath());
  }
  if (record.previousFileExisted) {
    writeJsonFileSync(getGlobalSecretsPath(), record.previousSecrets, 0o600);
  } else {
    removeFileSync(getGlobalSecretsPath());
  }
};

type SecretsRecoveryRead =
  | { kind: "missing" }
  | { kind: "valid"; record: SecretsRecoveryRecord }
  | { kind: "invalid"; error: SecretsStorageError };

const readSecretsRecovery = (): SecretsRecoveryRead => {
  const recoveryPath = getSecretsRecoveryPath();
  const readResult = readJsonFileSyncSafe<unknown>(recoveryPath);
  if (readResult.status === "missing") return { kind: "missing" };
  if (readResult.status === "corrupt") {
    return {
      kind: "invalid",
      error: rollbackFailure(new Error("Secrets recovery record is not valid JSON")),
    };
  }

  const parsed = SecretsRecoveryRecordSchema.safeParse(readResult.data);
  if (!parsed.success) {
    return {
      kind: "invalid",
      error: rollbackFailure(new Error("Secrets recovery record failed validation")),
    };
  }

  return { kind: "valid", record: parsed.data };
};

// The caller must hold the config-file transaction lock. Recovery covers config and
// secrets as one aggregate, so replaying it outside that lock can roll back an active
// writer in another process.
const reconcileSecretsRecoveryAtStartup = (): SecretsStorageError | null => {
  const recovery = readSecretsRecovery();
  if (recovery.kind === "missing") return null;
  if (recovery.kind === "invalid") return recovery.error;

  try {
    restoreRecoveryRecordSync(recovery.record);
    removeFileSync(getSecretsRecoveryPath());
    return null;
  } catch (cause) {
    return rollbackFailure(cause);
  }
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
  ready(): Promise<Result<void, SecretsStorageError>>;
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
  const initialRecovery = readSecretsRecovery();
  const canReadInitialState = initialRecovery.kind === "missing";
  let startupRecoveryError = initialRecovery.kind === "invalid" ? initialRecovery.error : null;
  // A store can be constructed while another process owns the config lock and has
  // partially applied a recoverable secrets mutation. In that window, serve the
  // WAL's prior aggregate snapshot and freeze mtime refreshes until initialization
  // acquires the same lock. This keeps synchronous reads coherent without blocking
  // the event loop or changing the public API to async getters.
  let configState: ConfigState =
    initialRecovery.kind === "valid"
      ? parseConfigData(
          initialRecovery.record.previousConfigFileExisted
            ? initialRecovery.record.previousConfig
            : null,
        )
      : loadConfig();
  let secretsState: SecretsState =
    initialRecovery.kind === "valid"
      ? parseSecretsData(
          initialRecovery.record.previousFileExisted
            ? initialRecovery.record.previousSecrets
            : null,
        )
      : loadSecrets();
  const trustStore: TrustStore = createTrustStore();
  let initialized = false;

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

  const reloadConfigState = (currentMtime = getFileMtimeMs(getGlobalConfigPath())): void => {
    configState = loadConfig();
    configMtimeMs = currentMtime;
    syncLoadedProviders();
  };

  const refreshConfigState = (): void => {
    if (!initialized || startupRecoveryError) return;
    const currentMtime = getFileMtimeMs(getGlobalConfigPath());
    if (currentMtime === configMtimeMs) return;
    reloadConfigState(currentMtime);
  };

  const reloadSecretsState = (currentMtime = getFileMtimeMs(getGlobalSecretsPath())): void => {
    secretsState = loadSecrets();
    secretsMtimeMs = currentMtime;
    syncLoadedProviders();
  };

  const refreshSecretsState = (): void => {
    if (!initialized || startupRecoveryError) return;
    const currentMtime = getFileMtimeMs(getGlobalSecretsPath());
    if (currentMtime === secretsMtimeMs) return;
    reloadSecretsState(currentMtime);
  };

  const applyRecoverySnapshot = (record: SecretsRecoveryRecord): void => {
    configState = parseConfigData(record.previousConfigFileExisted ? record.previousConfig : null);
    secretsState = parseSecretsData(record.previousFileExisted ? record.previousSecrets : null);
    configMtimeMs = Number.NaN;
    secretsMtimeMs = Number.NaN;
    syncLoadedProviders();
  };

  const prepareAggregateRead = (): Result<void, SecretsStorageError> => {
    const recoveryBeforeRead = readSecretsRecovery();
    if (recoveryBeforeRead.kind === "invalid") {
      startupRecoveryError = recoveryBeforeRead.error;
      return err(recoveryBeforeRead.error);
    }
    if (recoveryBeforeRead.kind === "valid") {
      applyRecoverySnapshot(recoveryBeforeRead.record);
      return err(
        createError<SecretsStorageErrorCode>(
          "ROLLBACK_FAILED",
          "Secrets recovery initialization has not completed",
        ),
      );
    }
    if (startupRecoveryError) return err(startupRecoveryError);
    if (!initialized) {
      return canReadInitialState
        ? ok(undefined)
        : err(
            createError<SecretsStorageErrorCode>(
              "ROLLBACK_FAILED",
              "Secrets recovery initialization has not completed",
            ),
          );
    }

    refreshConfigState();
    refreshSecretsState();
    const recoveryAfterRead = readSecretsRecovery();
    if (recoveryAfterRead.kind === "invalid") {
      startupRecoveryError = recoveryAfterRead.error;
      return err(recoveryAfterRead.error);
    }
    if (recoveryAfterRead.kind === "valid") {
      applyRecoverySnapshot(recoveryAfterRead.record);
      return err(
        createError<SecretsStorageErrorCode>(
          "ROLLBACK_FAILED",
          "Secrets recovery initialization has not completed",
        ),
      );
    }
    return ok(undefined);
  };

  // Pre-mutation snapshot persistConfig diffs against to tell which providers/settings
  // THIS instance changed (overwrite disk) from those it left untouched (yield to a
  // concurrent instance's write) — F-359.
  let providersBeforeMutation: ProviderStatus[] = configState.providers.map((p) => ({ ...p }));
  let settingsBeforeMutation: SettingsConfig = { ...configState.settings };

  const persistConfig = async (
    persistMerged: PersistConfigMerged,
  ): Promise<Result<void, SecretsStorageError>> => {
    try {
      // Merge at per-provider and per-settings-field granularity so a change another
      // instance persisted during this window is not erased by this instance's full
      // provider array or stale settings object.
      configState = await persistMerged(
        configState,
        providersBeforeMutation,
        settingsBeforeMutation,
      );
      syncLoadedProviders();
      configMtimeMs = getFileMtimeMs(getGlobalConfigPath());
      return ok(undefined);
    } catch (cause) {
      return err(persistFailure("config", cause));
    }
  };

  const persistFileSecrets = async (
    previousState: SecretsState,
  ): Promise<Result<void, SecretsStorageError>> => {
    try {
      await persistSecretsAsync(secretsState, previousState);
      secretsState = loadSecrets();
      syncLoadedProviders();
      secretsMtimeMs = getFileMtimeMs(getGlobalSecretsPath());
      return ok(undefined);
    } catch (cause) {
      return err(persistFailure("secrets", cause));
    }
  };

  let activeSecretsRecovery: SecretsRecoveryRecord | null = null;

  const beginSecretsRecovery = async (
    previousState: SecretsState,
  ): Promise<Result<void, SecretsStorageError>> => {
    if (activeSecretsRecovery) return ok(undefined);
    const configRead = readJsonFileSyncSafe<unknown>(getGlobalConfigPath());
    if (configRead.status === "corrupt") {
      return err(persistFailure("config", new Error("Config snapshot is not valid JSON")));
    }
    const record: SecretsRecoveryRecord = {
      version: 1,
      previousConfigFileExisted: configRead.status === "ok",
      previousConfig: configRead.status === "ok" ? configRead.data : null,
      previousFileExisted: getFileMtimeMs(getGlobalSecretsPath()) !== null,
      previousSecrets: serializeSecretsState(previousState),
    };
    try {
      await writeJsonFile(getSecretsRecoveryPath(), record, 0o600);
      activeSecretsRecovery = record;
      return ok(undefined);
    } catch (cause) {
      return err(persistFailure("secrets", cause));
    }
  };

  const clearSecretsRecovery = (): Result<void, SecretsStorageError> => {
    if (!activeSecretsRecovery) return ok(undefined);
    try {
      removeFileSync(getSecretsRecoveryPath());
      activeSecretsRecovery = null;
      return ok(undefined);
    } catch (cause) {
      return err(rollbackFailure(cause));
    }
  };

  const restoreSecretsState = async (
    backup: SecretsState,
  ): Promise<Result<void, SecretsStorageError>> => {
    const failedState = cloneSecretsState(secretsState);
    try {
      if (activeSecretsRecovery) {
        const currentConfig = readJsonFileSyncSafe<unknown>(getGlobalConfigPath());
        const configAlreadyRestored = activeSecretsRecovery.previousConfigFileExisted
          ? currentConfig.status === "ok" &&
            isDeepStrictEqual(currentConfig.data, activeSecretsRecovery.previousConfig)
          : currentConfig.status === "missing";
        if (!configAlreadyRestored) {
          if (activeSecretsRecovery.previousConfigFileExisted) {
            await writeJsonFile(getGlobalConfigPath(), activeSecretsRecovery.previousConfig, 0o600);
          } else {
            removeFileSync(getGlobalConfigPath());
          }
        }
        reloadConfigState();

        if (activeSecretsRecovery.previousFileExisted) {
          await writeJsonFile(getGlobalSecretsPath(), activeSecretsRecovery.previousSecrets, 0o600);
        } else {
          removeFileSync(getGlobalSecretsPath());
        }
      } else {
        secretsState = cloneSecretsState(backup);
        const rollbackResult = await persistFileSecrets(failedState);
        if (!rollbackResult.ok) throw new Error(rollbackResult.error.message);
      }
      secretsState = cloneSecretsState(backup);
      secretsMtimeMs = getFileMtimeMs(getGlobalSecretsPath());
      syncLoadedProviders();
    } catch (cause) {
      reloadConfigState();
      reloadSecretsState();
      return err(rollbackFailure(cause));
    }

    return clearSecretsRecovery();
  };

  const persistRecoverableFileSecrets = async (
    previousState: SecretsState,
  ): Promise<Result<void, SecretsStorageError>> => {
    const recoveryResult = await beginSecretsRecovery(previousState);
    if (!recoveryResult.ok) return recoveryResult;

    const persistResult = await persistFileSecrets(previousState);
    if (persistResult.ok) return persistResult;

    const rollbackResult = await restoreSecretsState(previousState);
    return rollbackResult.ok ? persistResult : rollbackResult;
  };

  const restoreKeyringSecret = (
    providerId: string,
    previousValue: string | null,
  ): Result<void, SecretsStorageError> => {
    const rollbackResult =
      previousValue === null
        ? deleteKeyringSecret(getApiKeyName(providerId))
        : writeKeyringSecret(getApiKeyName(providerId), previousValue);
    if (!rollbackResult.ok) {
      log("warn", "keyring_rollback_failed", {
        providerId,
        error: rollbackResult.error.message,
      });
      return err(rollbackFailure(rollbackResult.error));
    }
    return ok(undefined);
  };

  // Called at each mutation's snapshot point (after disk refresh, before mutation) to
  // record the pre-mutation state persistConfig later merges against (F-359).
  const markConfigBeforeMutation = (): void => {
    providersBeforeMutation = configState.providers.map((p) => ({ ...p }));
    settingsBeforeMutation = { ...configState.settings };
  };

  // The config-file transaction wrapper reloads before invoking these dependencies.
  // Persist receives the callback-scoped writer so it cannot reacquire the same lock.
  const configTransactionDeps = (persistMerged: PersistConfigMerged) => ({
    refresh: () => {},
    snapshot: () => {
      markConfigBeforeMutation();
      return cloneConfigState(configState);
    },
    restore: (backup: ConfigState) => {
      configState = backup;
    },
    persist: () => persistConfig(persistMerged),
  });

  const runConfigFileMutation = async <T>(
    operation: (persistMerged: PersistConfigMerged) => Promise<Result<T, SecretsStorageError>>,
  ): Promise<Result<T, SecretsStorageError>> => {
    try {
      return await withConfigFileTransaction(async (persistMerged) => {
        startupRecoveryError = reconcileSecretsRecoveryAtStartup();
        if (startupRecoveryError) return err(startupRecoveryError);
        activeSecretsRecovery = null;
        // Reload unconditionally after acquiring the cross-process lock. An mtime
        // equality check is not a transaction boundary and can miss same-tick writes.
        reloadConfigState();
        reloadSecretsState();
        return operation(persistMerged);
      });
    } catch (cause) {
      return err(persistFailure("config", cause));
    }
  };

  const rollbackCommittedFileMutation = async (
    secretsBackup: SecretsState,
    failure: SecretsStorageError,
  ): Promise<Result<never, SecretsStorageError>> => {
    const secretsRollback = await restoreSecretsState(secretsBackup);
    if (!secretsRollback.ok) return secretsRollback;
    return err(failure);
  };

  // Complete an interrupted secrets-storage migration (crash between the config write
  // and the file/keyring cleanup, F-449). Keyring mode moves stranded secrets.json
  // literals into the keyring. Explicit file mode deletes only entries with a
  // completed file copy. Best-effort keyring failures leave state intact.
  const reconcileStartupStorage = async (): Promise<void> => {
    if (startupRecoveryError) return;
    const startupStorage = configState.settings.secretsStorage;
    if (startupStorage === "keyring") {
      const secretsBeforeReconcile = cloneSecretsState(secretsState);
      const reconciled = reconcileKeyringSecrets(secretsState);
      if (!reconciled.ok) {
        log("warn", "secrets_reconcile_failed", { error: reconciled.error.message });
      } else if (reconciled.value) {
        secretsState = reconciled.value.nextSecrets;
        const result = await persistFileSecrets(secretsBeforeReconcile);
        if (!result.ok) {
          log("warn", "secrets_reconcile_persist_failed", { error: result.error.message });
        }
        log("info", "secrets_reconciled", { migrated: reconciled.value.migrated.join(",") });
      }
      deleteShadowedKeyringEntries(secretsState);
      return;
    }

    if (startupStorage === "file") {
      const orphans = findOrphanedKeyringEntries(configState, secretsState);
      if (!orphans.ok) {
        log("warn", "keyring_reconcile_failed", { error: orphans.error.message });
      } else if (orphans.value.length > 0) {
        finalizeKeyringDeletions(orphans.value);
        log("info", "keyring_reconciled", { deleted: orphans.value.join(",") });
      }
    }
  };

  const initialization = mutex.run(async () => {
    try {
      await withConfigFileTransaction(async () => {
        startupRecoveryError = reconcileSecretsRecoveryAtStartup();
        if (startupRecoveryError) return;

        reloadConfigState();
        reloadSecretsState();
        await reconcileStartupStorage();
        reloadConfigState();
        reloadSecretsState();
      });
    } catch (cause) {
      startupRecoveryError = persistFailure("config", cause);
    } finally {
      initialized = true;
    }
  });
  void initialization.catch((cause: unknown) => {
    log("warn", "startup_reconcile_failed", { error: getErrorMessage(cause) });
  });

  const getSettings = (): SettingsConfig => {
    prepareAggregateRead();
    return { ...configState.settings };
  };

  const ready = async (): Promise<Result<void, SecretsStorageError>> => {
    await initialization;
    return startupRecoveryError ? err(startupRecoveryError) : ok(undefined);
  };

  const migrateStorage = async (
    nextSettings: SettingsConfig,
    currentStorage: SecretsStorage,
    nextStorage: SecretsStorage,
    persistMerged: PersistConfigMerged,
  ): Promise<Result<SettingsConfig, SecretsStorageError>> => {
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
    const recoveryPreparation = await beginSecretsRecovery(secretsBackup);
    if (!recoveryPreparation.ok) {
      const keyringRollback = rollbackKeyringWrites(migrateResult.value.keyringWrites);
      return keyringRollback.ok ? recoveryPreparation : keyringRollback;
    }

    if (nextStorage === "keyring") {
      configState = {
        ...configState,
        settings: nextSettings,
      };
      const configResult = await persistConfig(persistMerged);
      if (!configResult.ok) {
        configState = configBackup;
        const recoveryRollback = await restoreSecretsState(secretsBackup);
        const keyringRollback = rollbackKeyringWrites(migrateResult.value.keyringWrites);
        if (!recoveryRollback.ok) return recoveryRollback;
        return keyringRollback.ok ? configResult : keyringRollback;
      }

      secretsState = cloneSecretsState(migrateResult.value.nextSecrets);
      const secretsResult = await persistRecoverableFileSecrets(secretsBackup);
      if (!secretsResult.ok) {
        const keyringRollback = rollbackKeyringWrites(migrateResult.value.keyringWrites);
        return keyringRollback.ok ? secretsResult : keyringRollback;
      }
    } else {
      secretsState = cloneSecretsState(migrateResult.value.nextSecrets);
      const secretsResult = await persistRecoverableFileSecrets(secretsBackup);
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

      const configResult = await persistConfig(persistMerged);
      if (!configResult.ok) {
        configState = configBackup;
        const rollbackResult = await restoreSecretsState(secretsBackup);
        return rollbackResult.ok ? configResult : rollbackResult;
      }
    }

    const recoveryCompletion = clearSecretsRecovery();
    if (!recoveryCompletion.ok) {
      const rollbackResult = await rollbackCommittedFileMutation(
        secretsBackup,
        recoveryCompletion.error,
      );
      const keyringRollback = rollbackKeyringWrites(migrateResult.value.keyringWrites);
      return keyringRollback.ok ? rollbackResult : keyringRollback;
    }

    if (migrateResult.value.keyringDeletions.length > 0) {
      finalizeKeyringDeletions(migrateResult.value.keyringDeletions);
    }

    syncLoadedProviders();

    return ok({ ...configState.settings });
  };

  const updateSettings = (
    patch: Partial<SettingsConfig>,
  ): Promise<Result<SettingsConfig, SecretsStorageError>> =>
    mutex.run(() =>
      runConfigFileMutation(async (persistMerged) => {
        const nextSettings: SettingsConfig = {
          ...configState.settings,
          ...patch,
        };

        const currentStorage = effectiveStorage(configState);
        const nextStorage = nextSettings.secretsStorage;

        if (configState.settings.secretsStorage !== null && nextStorage === null) {
          return err(
            createError<SecretsStorageErrorCode>(
              "STORAGE_NOT_CONFIGURED",
              "Secrets storage cannot be cleared after configuration",
            ),
          );
        }

        if (currentStorage !== null && nextStorage !== null && currentStorage !== nextStorage) {
          return migrateStorage(nextSettings, currentStorage, nextStorage, persistMerged);
        }

        return runConfigTransaction(configTransactionDeps(persistMerged), () => {
          configState.settings = nextSettings;
          return ok({ ...configState.settings });
        });
      }),
    );

  const getProviders = (): ProviderStatus[] => {
    prepareAggregateRead();
    return configState.providers.map((provider) => ({ ...provider }));
  };

  const getActiveProvider = (): ProviderStatus | null => {
    prepareAggregateRead();
    return activeProvider(configState);
  };

  const readProviderApiKey = (providerId: string): Result<string | null, SecretsStorageError> => {
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

  const getProviderApiKey = (providerId: string): Result<string | null, SecretsStorageError> => {
    const readPreparation = prepareAggregateRead();
    if (!readPreparation.ok) return readPreparation;
    return readProviderApiKey(providerId);
  };

  const resolveRoot = (projectRoot?: string): string =>
    resolveProjectRoot({
      header: projectRoot ?? null,
      env: process.env.DIFFGAZER_PROJECT_ROOT ?? null,
      cwd: process.cwd(),
    });

  const onProjectMove = (oldRepoRoot: string, newRepoRoot: string): Promise<boolean> =>
    reviewRekeyHandler(oldRepoRoot, newRepoRoot);

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
    mutex.run(() =>
      runConfigFileMutation(async (persistMerged) => {
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
          const secretsResult = await persistRecoverableFileSecrets(secretsBackup);
          if (!secretsResult.ok) {
            secretsState = secretsBackup;
            return secretsResult;
          }
        } else if (typeof entry !== "string" && entry.kind === "env") {
          // Switching to an env credential must delete this provider's keyring literal,
          // or the sidecar env ref (resolved first on read) leaves it shadowed (F-105).
          // Capture for rollback, persist the sidecar, then delete — a crash between is
          // repaired at startup.
          const previousKeyringResult = readKeyringSecret(getApiKeyName(provider));
          if (!previousKeyringResult.ok) return previousKeyringResult;
          previousKeyringValue = previousKeyringResult.value;

          secretsState.providers[provider] = entry;
          const secretsResult = await persistRecoverableFileSecrets(secretsBackup);
          if (!secretsResult.ok) {
            secretsState = secretsBackup;
            return secretsResult;
          }

          if (previousKeyringValue !== null) {
            const deleteResult = deleteKeyringSecret(getApiKeyName(provider));
            if (!deleteResult.ok) {
              const rollbackResult = await restoreSecretsState(secretsBackup);
              return rollbackResult.ok ? deleteResult : rollbackResult;
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
            const secretsResult = await persistRecoverableFileSecrets(secretsBackup);
            if (!secretsResult.ok) {
              const keyringRollback = restoreKeyringSecret(provider, previousKeyringValue);
              const rollbackResult = await restoreSecretsState(secretsBackup);
              if (!keyringRollback.ok) return keyringRollback;
              return rollbackResult.ok ? secretsResult : rollbackResult;
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

        const configResult = await persistConfig(persistMerged);
        if (!configResult.ok) {
          configState = configBackup;
          const rollbackResult = await restoreSecretsState(secretsBackup);
          const keyringRollback = touchedKeyring
            ? restoreKeyringSecret(provider, previousKeyringValue)
            : ok(undefined);
          if (!keyringRollback.ok) return keyringRollback;
          return rollbackResult.ok ? configResult : rollbackResult;
        }

        const recoveryCompletion = clearSecretsRecovery();
        if (!recoveryCompletion.ok) {
          const rollbackResult = await rollbackCommittedFileMutation(
            secretsBackup,
            recoveryCompletion.error,
          );
          const keyringRollback = touchedKeyring
            ? restoreKeyringSecret(provider, previousKeyringValue)
            : ok(undefined);
          if (!keyringRollback.ok) return keyringRollback;
          return rollbackResult;
        }

        const savedProvider = configState.providers.find((item) => item.provider === provider);
        return ok(savedProvider ? { ...savedProvider } : { ...ensured.entry, hasApiKey: true });
      }),
    );

  const activateProvider = (input: {
    provider: AIProvider;
    model?: string;
  }): Promise<Result<ProviderStatus | null, SecretsStorageError>> =>
    mutex.run(() =>
      runConfigFileMutation(async (persistMerged) => {
        const result = await runConfigTransaction(configTransactionDeps(persistMerged), () => {
          const { provider, model } = input;
          const existing = configState.providers.find((item) => item.provider === provider);
          if (!existing) return ok(null);
          if (!model && !existing.model) return ok(null);

          const apiKeyResult = readProviderApiKey(provider);
          if (!apiKeyResult.ok) return apiKeyResult;
          if (!apiKeyResult.value) {
            return err(
              createError(
                "SECRET_NOT_FOUND",
                "Provider credential was removed before activation completed",
              ),
            );
          }

          configState.providers = applyActiveProvider(configState.providers, {
            providerId: provider,
            model,
            preserveModel: true,
          });

          return ok(activeProvider(configState));
        });
        if (!result.ok || result.value === null) return result;
        return ok(activeProvider(configState));
      }),
    );

  const deleteProviderCredentials = (
    providerId: AIProvider,
  ): Promise<Result<boolean, SecretsStorageError>> =>
    mutex.run(() =>
      runConfigFileMutation(async (persistMerged) => {
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
          const secretsResult = await persistRecoverableFileSecrets(secretsBackup);
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
            const secretsResult = await persistRecoverableFileSecrets(secretsBackup);
            if (!secretsResult.ok) {
              const keyringRollback = touchedKeyring
                ? restoreKeyringSecret(providerId, previousKeyringValue)
                : ok(undefined);
              const rollbackResult = await restoreSecretsState(secretsBackup);
              if (!keyringRollback.ok) return keyringRollback;
              return rollbackResult.ok ? secretsResult : rollbackResult;
            }
            hadSecret = true;
          }
        }

        configState.providers = clearProviderCredentials(configState.providers, providerId);
        const configResult = await persistConfig(persistMerged);
        if (!configResult.ok) {
          configState = configBackup;
          const rollbackResult = await restoreSecretsState(secretsBackup);
          const keyringRollback = touchedKeyring
            ? restoreKeyringSecret(providerId, previousKeyringValue)
            : ok(undefined);
          if (!keyringRollback.ok) return keyringRollback;
          return rollbackResult.ok ? configResult : rollbackResult;
        }

        const recoveryCompletion = clearSecretsRecovery();
        if (!recoveryCompletion.ok) {
          const rollbackResult = await rollbackCommittedFileMutation(
            secretsBackup,
            recoveryCompletion.error,
          );
          const keyringRollback = touchedKeyring
            ? restoreKeyringSecret(providerId, previousKeyringValue)
            : ok(undefined);
          if (!keyringRollback.ok) return keyringRollback;
          return rollbackResult;
        }
        return ok(providerExists || hadSecret);
      }),
    );

  return {
    ready,
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
