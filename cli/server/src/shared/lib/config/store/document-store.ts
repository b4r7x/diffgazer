import { createError, getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import {
  atomicWriteFile,
  quarantineCorruptFile,
  removeFileSync,
  removeOrphanTempSiblings,
} from "../../fs.js";
import { log } from "../../log.js";
import { getGlobalConfigPath, getGlobalSecretsPath } from "../../paths.js";
import type { AdmissionEvidence } from "../admission-evidence.js";
import { budgetForSelectedModel } from "../budget-ceiling.js";
import { serializeConfigV2 } from "../persistence/config.js";
import {
  decodeSecretsV1,
  type SecretsDocumentV2,
  serializeSecretsV2,
} from "../persistence/secrets.js";
import {
  clearDocumentRecovery,
  type DocumentRecoveryRecord,
  getSecretsRecoveryPath,
  readDocumentRecovery,
  restoreDocumentRecovery,
  rewriteDocumentRecovery,
  writeDocumentRecovery,
} from "../persistence/secrets-recovery.js";
import type {
  ConfigurationBudgetLimits,
  SupportedProviderConfigurationRecord,
} from "../provider-config.js";
import { withFileTransactionLock } from "../transaction/file-lock.js";
import { createMutex } from "../transaction/mutex.js";
import type {
  ConfigDocumentV1,
  ConfigDocumentV2,
  ConfigurationActionError,
  SecretsState,
  SecretsStorageError,
  SecretsStorageErrorCode,
} from "../types.js";
import { configurationActionFailure, V1_MIGRATION_FAILED_MESSAGE } from "../types.js";
import { upgradeV1Documents } from "../v1-upgrade.js";
import {
  type CapturedDocuments,
  createDocumentCapture,
  EMPTY_CONFIG_DOCUMENT,
  EMPTY_SECRETS_DOCUMENT,
} from "./document-capture.js";
import {
  captureDocumentFingerprints,
  type DocumentFingerprints,
  sameDocumentFingerprints,
} from "./document-fingerprint.js";
import { createEvidenceStore } from "./evidence-store.js";

const textEncoder = new TextEncoder();

const encodeJsonBytes = (value: unknown): Uint8Array => textEncoder.encode(JSON.stringify(value));

export interface DocumentStore {
  getConfigDocument(): ConfigDocumentV2;
  setConfigDocument(document: ConfigDocumentV2): void;
  getSecretsDocument(): SecretsDocumentV2;
  setSecretsDocument(document: SecretsDocumentV2): void;
  getEvidence(configurationId: string): AdmissionEvidence | null;
  setEvidence(configurationId: string, evidence: AdmissionEvidence): void;
  clearConfigurationEvidence(configurationId: string): void;
  reloadEvidence(): void;
  encodeJsonBytes(value: unknown): Uint8Array;
  writeEvidence(evidenceReference: string, evidence: AdmissionEvidence): Promise<void>;
  persistFailure(cause: unknown): ConfigurationActionError;
  writeDocuments(): Promise<Result<void, ConfigurationActionError>>;
  runMutation<T>(
    operation: () => Promise<Result<T, ConfigurationActionError>>,
  ): Promise<Result<T, ConfigurationActionError>>;
  /**
   * May serve a consistent in-memory snapshot; otherwise behaves exactly like
   * `runMutation`. See `documentsMatchDisk` for when memory is allowed to answer.
   */
  runRead<T>(
    operation: () => Promise<Result<T, ConfigurationActionError>>,
  ): Promise<Result<T, ConfigurationActionError>>;
  readCurrentState(): Promise<Result<CurrentDocumentState, ConfigurationActionError>>;
  /**
   * Registers startup work owned by a layer above this store. `ready()` drains it, so the
   * work can never outlive a drained store: `paths.ts` re-reads `DIFFGAZER_HOME` per call,
   * so a still-pending credential mutation would re-point at whatever home is current by then.
   */
  scheduleStartupWork(work: () => Promise<void>): void;
  ready(): Promise<Result<void, ConfigurationActionError>>;
}

export interface CurrentDocumentState {
  readonly config: ConfigDocumentV2;
  readonly secrets: SecretsDocumentV2;
  readonly evidenceByConfiguration: ReadonlyMap<string, AdmissionEvidence>;
}

type DocumentStoreDependencies = Readonly<{
  budget: ConfigurationBudgetLimits;
}>;

export function createDocumentStore(deps: DocumentStoreDependencies): DocumentStore {
  const mutex = createMutex();
  let startupError: SecretsStorageError | null = null;
  let upgradeError: SecretsStorageError | null = null;
  let loadError: ConfigurationActionError | null = null;
  let rollbackError: ConfigurationActionError | null = null;

  let configDocument: ConfigDocumentV2 = EMPTY_CONFIG_DOCUMENT;
  let secretsDocument: SecretsDocumentV2 = EMPTY_SECRETS_DOCUMENT;
  const evidence = createEvidenceStore();
  let configBytesBeforeMutation: Uint8Array | null = null;
  let secretsBytesBeforeMutation: Uint8Array | null = null;
  let pendingV1Config: ConfigDocumentV1 | null = null;
  let loadedFingerprints: DocumentFingerprints | null = null;

  const latchV1MigrationFailure = (): SecretsStorageError => {
    if (upgradeError?.code === "SECRETS_MIGRATION_FAILED") return upgradeError;
    upgradeError = createError<SecretsStorageErrorCode>(
      "SECRETS_MIGRATION_FAILED",
      V1_MIGRATION_FAILED_MESSAGE,
    );
    return upgradeError;
  };

  const capture = createDocumentCapture({
    budget: deps.budget,
    latch: {
      latched: () => (upgradeError?.code === "SECRETS_MIGRATION_FAILED" ? upgradeError : null),
      latch: latchV1MigrationFailure,
    },
  });

  const clearV1MigrationFailure = (): void => {
    if (upgradeError?.code === "SECRETS_MIGRATION_FAILED") upgradeError = null;
    if (loadError?.code === "SECRETS_MIGRATION_FAILED") loadError = null;
  };

  // In memory only. The ceiling is recomputed from the bundled catalog wherever it
  // is enforced, so a load must never rewrite the user's file to chase a snapshot bump.
  const applyBudgetReclamp = (document: ConfigDocumentV2): ConfigDocumentV2 => {
    let changed = false;
    const configurations = document.configurations.map((entry) => {
      if (entry.status !== "supported") return entry;
      const budget = budgetForSelectedModel(
        entry.record.budget,
        entry.record.productId,
        entry.record.selectedModelId,
      );
      if (budget.inputTokens === entry.record.budget.inputTokens) return entry;
      changed = true;
      const nextRecord: SupportedProviderConfigurationRecord = { ...entry.record, budget };
      return {
        status: "supported" as const,
        record: nextRecord,
        rawBytes: encodeJsonBytes(nextRecord),
      };
    });
    if (!changed) return document;
    return { ...document, configurations };
  };

  const applyCapturedDocuments = (captured: CapturedDocuments): void => {
    configBytesBeforeMutation = captured.configBytes;
    secretsBytesBeforeMutation = captured.secretsBytes;
    if (captured.kind === "v1") {
      pendingV1Config = captured.config;
      configDocument = { ...EMPTY_CONFIG_DOCUMENT, settings: captured.config.settings };
      secretsDocument = EMPTY_SECRETS_DOCUMENT;
    } else {
      pendingV1Config = null;
      configDocument = captured.config;
      secretsDocument = captured.secrets;
      clearV1MigrationFailure();
    }
    configDocument = applyBudgetReclamp(configDocument);
    evidence.reload(configDocument.configurations);
  };

  // The fingerprints belong to the caller, which takes them before the bytes are
  // read: a document replaced mid-read is then remembered as changed, so the next
  // read revalidates it under the locks instead of trusting memory.
  const loadDocumentsFromDisk = (
    fingerprints: DocumentFingerprints,
    captured?: CapturedDocuments,
  ): Result<void, ConfigurationActionError> => {
    const current = captured === undefined ? capture.inspectDominantV1State() : ok(captured);
    if (!current.ok) {
      log("warn", "config_v1_upgrade_blocked", {
        code: current.error.code,
        operation: "preflight",
      });
      return current;
    }
    if (current.value === null) {
      log("warn", "config_v2_load_failed", {
        code: "CONFIGURATION_UNSUPPORTED",
        operation: "decode",
      });
      return err(
        configurationActionFailure(
          "CONFIGURATION_UNSUPPORTED",
          "Configuration file is not supported by this version",
        ),
      );
    }
    applyCapturedDocuments(current.value);
    loadedFingerprints = fingerprints;
    return ok(undefined);
  };

  // The cause carries the absolute path, so it goes to this server's own log while
  // the returned message stays path-free for API clients.
  const persistFailure = (operation: "config" | "secrets", cause: unknown): SecretsStorageError => {
    log("error", "config_persist_failed", {
      code: "PERSIST_FAILED",
      operation,
      error: getErrorMessage(cause),
    });
    return createError<SecretsStorageErrorCode>("PERSIST_FAILED", `Failed to persist ${operation}`);
  };

  const persistV2Failure = (cause: unknown): ConfigurationActionError => {
    log("error", "config_v2_persist_failed", {
      code: "PERSIST_FAILED",
      operation: "persist",
      error: getErrorMessage(cause),
    });
    return configurationActionFailure("PERSIST_FAILED", "Failed to persist configuration");
  };

  const latchRollbackFailure = (message: string): ConfigurationActionError => {
    rollbackError ??= configurationActionFailure("ROLLBACK_FAILED", message);
    return rollbackError;
  };

  const reconcileLockedRecovery = async (): Promise<Result<void, ConfigurationActionError>> => {
    if (rollbackError) return err(rollbackError);
    const recovery = readDocumentRecovery();
    if (recovery.kind === "missing") {
      startupError = null;
      return ok(undefined);
    }
    if (recovery.kind === "valid") {
      const blockedRecovery = capture.inspectRecoveryRecordV1State(recovery.record);
      if (!blockedRecovery.ok) return blockedRecovery;
    }
    let recovered: SecretsStorageError | null;
    if (recovery.kind === "valid") {
      recovered = await restoreDocumentRecovery(recovery.record);
    } else {
      try {
        quarantineCorruptFile(getSecretsRecoveryPath());
        recovered = recovery.error;
      } catch {
        recovered = createError<SecretsStorageErrorCode>(
          "ROLLBACK_FAILED",
          "Failed to restore secrets after a partial persistence failure",
        );
      }
    }
    if (!recovered) {
      startupError = null;
      return ok(undefined);
    }

    startupError = recovered;
    rollbackError ??= recovered;
    return err(rollbackError);
  };

  const reloadAfterRollback = (): Result<void, ConfigurationActionError> => {
    const reloaded = loadDocumentsFromDisk(captureDocumentFingerprints());
    if (!reloaded.ok) {
      loadError = reloaded.error;
      return reloaded;
    }
    loadError = null;
    return ok(undefined);
  };

  const compensateFailedWrite = async (
    journal: DocumentRecoveryRecord,
    cause: unknown,
    rollbackMessage: string,
    options?: { readonly reestablishJournal?: boolean },
  ): Promise<Result<void, ConfigurationActionError>> => {
    if (options?.reestablishJournal) {
      try {
        await rewriteDocumentRecovery(journal);
      } catch {
        log("error", "config_recovery_reestablish_failed", {
          code: "ROLLBACK_FAILED",
          operation: "reestablish-recovery",
        });
        return err(latchRollbackFailure(rollbackMessage));
      }
    }
    const restored = await capture.restoreRecovery(journal);
    if (restored) return err(latchRollbackFailure(rollbackMessage));

    const reloaded = reloadAfterRollback();
    if (!reloaded.ok) return err(latchRollbackFailure(rollbackMessage));
    return err(persistV2Failure(cause));
  };

  // Every caller runs inside `runMutation`, which has already validated the store
  // state and reconciled any journal under these same locks.
  const writeDocuments = async (): Promise<Result<void, ConfigurationActionError>> => {
    let journal: DocumentRecoveryRecord;
    try {
      journal = await writeDocumentRecovery({
        config: configBytesBeforeMutation,
        secrets: secretsBytesBeforeMutation,
      });
    } catch (cause) {
      const reconciled = await reconcileLockedRecovery();
      if (!reconciled.ok) return reconciled;
      const reloaded = reloadAfterRollback();
      if (!reloaded.ok)
        return err(latchRollbackFailure("Failed to roll back configuration changes"));
      return err(persistV2Failure(cause));
    }

    let committedConfigBytes: Uint8Array;
    let committedSecretsBytes: Uint8Array | null;
    try {
      committedConfigBytes = serializeConfigV2(configDocument);
      committedSecretsBytes =
        secretsDocument.bindings.length === 0 ? null : serializeSecretsV2(secretsDocument);
      await atomicWriteFile(getGlobalConfigPath(), committedConfigBytes, 0o600);
      if (committedSecretsBytes === null) {
        removeFileSync(getGlobalSecretsPath());
      } else {
        await atomicWriteFile(getGlobalSecretsPath(), committedSecretsBytes, 0o600);
      }
    } catch (cause) {
      return compensateFailedWrite(journal, cause, "Failed to roll back configuration changes");
    }

    try {
      clearDocumentRecovery();
    } catch (cause) {
      log("error", "config_recovery_clear_failed", {
        code: "ROLLBACK_FAILED",
        operation: "clear-recovery",
      });
      const recoveryAfterClearFailure = readDocumentRecovery();
      return compensateFailedWrite(journal, cause, "Failed to complete the configuration commit", {
        reestablishJournal: recoveryAfterClearFailure.kind === "missing",
      });
    }
    configBytesBeforeMutation = committedConfigBytes;
    secretsBytesBeforeMutation = committedSecretsBytes;
    loadedFingerprints = captureDocumentFingerprints();
    return ok(undefined);
  };

  const upgradePendingV1Document = async (): Promise<Result<void, ConfigurationActionError>> => {
    const documentV1 = pendingV1Config;
    if (!documentV1) return ok(undefined);

    let secretsV1: SecretsState;
    try {
      secretsV1 =
        secretsBytesBeforeMutation === null
          ? { providers: {} }
          : decodeSecretsV1(secretsBytesBeforeMutation);
    } catch {
      const error = latchV1MigrationFailure();
      return err(error);
    }

    const upgraded = await upgradeV1Documents(documentV1, secretsV1, { budget: deps.budget });
    if (!upgraded.ok) {
      upgradeError = upgraded.error;
      return err(upgraded.error);
    }

    for (const provider of upgraded.value.retiredProviders) {
      log("warn", "config_v1_provider_dropped", { provider });
    }
    configDocument = upgraded.value.configDocument;
    secretsDocument = upgraded.value.secretsDocument;
    const persisted = await writeDocuments();
    if (!persisted.ok) {
      if (persisted.error.code === "SECRETS_MIGRATION_FAILED") return persisted;
      upgradeError = createError<SecretsStorageErrorCode>(
        "PERSIST_FAILED",
        "Failed to persist the upgraded configuration",
      );
      return persisted;
    }

    pendingV1Config = null;
    upgradeError = null;
    evidence.reload(configDocument.configurations);
    log("info", "config_v1_upgraded", { configurations: configDocument.configurations.length });
    return ok(undefined);
  };

  const reloadDocuments = async (
    fingerprints: DocumentFingerprints,
    captured?: CapturedDocuments,
  ): Promise<Result<void, ConfigurationActionError>> => {
    const loaded = loadDocumentsFromDisk(fingerprints, captured);
    if (!loaded.ok) {
      loadError = loaded.error;
      return loaded;
    }
    loadError = null;
    return upgradePendingV1Document();
  };

  const reloadInsideTransaction = async (): Promise<Result<void, ConfigurationActionError>> => {
    const reconciled = await reconcileLockedRecovery();
    if (!reconciled.ok) return reconciled;
    const fingerprints = captureDocumentFingerprints();
    const current = capture.inspectDominantV1State();
    if (!current.ok) return current;
    return reloadDocuments(fingerprints, current.value ?? undefined);
  };

  const withDocumentLocks = <T>(
    operation: () => Promise<Result<T, ConfigurationActionError>>,
  ): Promise<Result<T, ConfigurationActionError>> =>
    withFileTransactionLock(getGlobalConfigPath(), () =>
      withFileTransactionLock(getGlobalSecretsPath(), operation),
    );

  // An interrupted atomic write strands a temp sibling holding the whole payload, and
  // for the journal that payload is a copy of the secrets file. Swept once at startup
  // under both locks, where no other write can be staging under these names.
  const sweepOrphanTempFiles = (): void => {
    removeOrphanTempSiblings(getGlobalConfigPath());
    removeOrphanTempSiblings(getGlobalSecretsPath());
    removeOrphanTempSiblings(getSecretsRecoveryPath());
  };

  const initialization = mutex.run(async () => {
    const dominantV1 = capture.inspectDominantStoreState();
    if (!dominantV1.ok) return;
    try {
      const reloaded = await withDocumentLocks(() => {
        sweepOrphanTempFiles();
        return reloadInsideTransaction();
      });
      if (!reloaded.ok) loadError = reloaded.error;
    } catch (cause) {
      startupError = persistFailure("config", cause);
    }
  });
  void initialization.catch((cause: unknown) => {
    log("warn", "startup_reconcile_failed", {
      code: "PERSIST_FAILED",
      operation: "startup",
      error: getErrorMessage(cause),
    });
  });

  const startupWork: Promise<void>[] = [];

  const scheduleStartupWork = (work: () => Promise<void>): void => {
    // Failures are absorbed here so a rejected task cannot break the `ready()` drain that
    // teardown relies on; the work itself reports through the store's own error surface.
    startupWork.push(
      initialization.then(work).catch((cause: unknown) => {
        log("warn", "startup_work_failed", {
          code: "PERSIST_FAILED",
          operation: "startup",
          error: getErrorMessage(cause),
        });
      }),
    );
  };

  const runMutation = async <T>(
    operation: () => Promise<Result<T, ConfigurationActionError>>,
  ): Promise<Result<T, ConfigurationActionError>> => {
    try {
      return await mutex.run(async () => {
        const dominantV1 = capture.inspectDominantStoreState();
        if (!dominantV1.ok) return dominantV1;
        if (rollbackError) return err(rollbackError);

        return withDocumentLocks(async () => {
          const reloaded = await reloadInsideTransaction();
          if (!reloaded.ok) return reloaded;
          const reloadFailure = upgradeError ?? rollbackError ?? loadError;
          if (reloadFailure) return err(reloadFailure);
          try {
            return await operation();
          } catch (cause) {
            return err(persistV2Failure(cause));
          }
        });
      });
    } catch (cause) {
      return err(persistV2Failure(cause));
    }
  };

  // Only "none of the three documents moved since they were loaded together" serves
  // memory. Every writer replaces at least one of them under the transaction locks,
  // so any mismatch sends the read down the locked path, where it waits for that
  // writer and reloads both documents together — a reader can never pair a new config
  // with an old secrets file, nor read past a journal only the locked path may
  // reconcile. The latches mirror what `runMutation` refuses to serve, so the fast
  // path stays a strict subset of it. The evidence files are the deliberate
  // exception: they carry no fingerprint and ride on the config record instead,
  // which every publish (`runRecordEvidence`) and every removal
  // (`clearConfigurationEvidence`) rewrites in the same locked transaction — so
  // evidence changed behind the store's back, by something other than a store
  // write, is the one disk change a fast-path read cannot see. One boundary sits
  // at the commit itself, which recaptures its fingerprints by stat-ing the files
  // just after writing them: a writer that ignored the transaction locks and
  // landed in that window would be adopted as this store's own identity and
  // masked from then on, so every writer in this repo takes the locks.
  const documentsMatchDisk = (): boolean => {
    if (loadedFingerprints === null || pendingV1Config !== null) return false;
    if (upgradeError ?? rollbackError ?? loadError) return false;
    return sameDocumentFingerprints(loadedFingerprints, captureDocumentFingerprints());
  };

  const runRead = async <T>(
    operation: () => Promise<Result<T, ConfigurationActionError>>,
  ): Promise<Result<T, ConfigurationActionError>> => {
    try {
      const served = await mutex.run(async () => (documentsMatchDisk() ? await operation() : null));
      if (served !== null) return served;
    } catch (cause) {
      return err(persistV2Failure(cause));
    }
    return runMutation(operation);
  };

  const readCurrentState = (): Promise<Result<CurrentDocumentState, ConfigurationActionError>> =>
    runRead(async () =>
      ok({
        config: configDocument,
        secrets: secretsDocument,
        evidenceByConfiguration: evidence.snapshot(),
      }),
    );

  return {
    getConfigDocument: () => configDocument,
    setConfigDocument: (document: ConfigDocumentV2) => {
      configDocument = document;
    },
    getSecretsDocument: () => secretsDocument,
    setSecretsDocument: (document: SecretsDocumentV2) => {
      secretsDocument = document;
    },
    getEvidence: (configurationId: string) => evidence.get(configurationId),
    setEvidence: (configurationId: string, admission: AdmissionEvidence) => {
      evidence.set(configurationId, admission);
    },
    clearConfigurationEvidence: (configurationId: string) => {
      evidence.clear(configurationId);
    },
    reloadEvidence: () => {
      evidence.reload(configDocument.configurations);
    },
    encodeJsonBytes,
    writeEvidence: (evidenceReference: string, admission: AdmissionEvidence) =>
      evidence.write(evidenceReference, admission),
    persistFailure: persistV2Failure,
    writeDocuments,
    runMutation,
    runRead,
    readCurrentState,
    scheduleStartupWork,
    ready: async (): Promise<Result<void, ConfigurationActionError>> => {
      await initialization;
      await Promise.all(startupWork);
      return mutex.run(async () => {
        const dominantV1 = capture.inspectDominantStoreState();
        if (!dominantV1.ok) return dominantV1;
        if (rollbackError) return err(rollbackError);
        try {
          return await withDocumentLocks(async () => {
            const reloaded = await reloadInsideTransaction();
            if (!reloaded.ok) return reloaded;
            const failure = upgradeError ?? rollbackError ?? startupError ?? loadError;
            return failure ? err(failure) : ok(undefined);
          });
        } catch (cause) {
          return err(persistV2Failure(cause));
        }
      });
    },
  } satisfies DocumentStore;
}
