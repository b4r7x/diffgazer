import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createError, getErrorMessage } from "@diffgazer/core/errors";
import { CREDENTIAL_ENV_VARS, PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { err, ok, type Result } from "@diffgazer/core/result";
import {
  type ClientConfigurationAction,
  type ClientConfigurationActionName,
  type ClientConfigurationActionResponse,
  ClientConfigurationActionResponseSchema,
  ClientConfigurationActionSchema,
  type ClientConfigurationInput,
  type ClientConfigurationNotice,
  ClientConfigurationNoticeSchema,
  type ClientConfigurationSummary,
  ClientConfigurationSummarySchema,
  type ConfigurationId,
  type ConfigurationRevision,
  ExactModelIdSchema,
  type ProjectInfo,
  READINESS_PRESENTATION,
  REMOVED_PRODUCT_IDS,
  type Readiness,
  type ReadinessAcknowledgement,
  ReadinessSchema,
  type RunnableProductId,
  type SecretsStorage,
  type SettingsConfig,
  SettingsConfigSchema,
  type TrustConfig,
  type WriteOnlySecretInput,
} from "@diffgazer/core/schemas/config";
import {
  type EvidenceKey,
  type ExecutionLimits,
  sha256CanonicalJsonSync,
} from "@diffgazer/core/schemas/review";
import { atomicWriteFile, readJsonFileSyncSafe, removeFileSync, writeJsonFile } from "../fs.js";
import { log } from "../log.js";
import { getGlobalConfigPath, getGlobalSecretsPath, resolveProjectRoot } from "../paths.js";
import { type AdmissionEvidence, AdmissionEvidenceSchema } from "./admission-evidence.js";
import {
  type ConfigurationConformanceObservation,
  type ConfigurationConformanceSubject,
  runConfigurationConformance,
} from "./conformance.js";
import {
  deleteKeyringSecret,
  isKeyringAvailable,
  readKeyringSecret,
  writeKeyringSecret,
} from "./keyring.js";
import {
  decodeConfigFile,
  parseSettingsRecord,
  selectConfigV2,
  serializeConfigV2,
} from "./persistence/config.js";
import { createProjectFile, readProjectFile } from "./persistence/project.js";
import {
  type DecodedSecretBinding,
  loadSecretsV1,
  loadSecretsV2,
  SECRETS_SCHEMA_VERSION_V2,
  type SecretsDocumentV2,
  serializeSecretsV2,
} from "./persistence/secrets.js";
import {
  clearDocumentRecovery,
  type DocumentRecoveryRecord,
  reconcileDocumentRecoveryAtStartup,
  restoreDocumentRecovery,
  writeDocumentRecovery,
} from "./persistence/secrets-recovery.js";
import {
  type ConfigurationBudgetLimits,
  type DecodedProviderConfigurationRecord,
  type NonSecretTransportInput,
  NonSecretTransportInputSchema,
  type ProviderConfigurationRecord,
  type RemovedProviderConfigurationRecord,
  type SupportedProviderConfigurationRecord,
} from "./provider-config.js";
import { computeProviderReadinessResult } from "./readiness.js";
import { getConfigSeams } from "./seams.js";
import {
  bindWriteOnlySecret,
  createEnvironmentSecretBinding,
  createLocalBearerBinding,
  createNoneSecretBinding,
  deleteSecretBinding,
  type KeyringSecretStore,
  type SecretBinding,
  type SecretBindingIO,
  SecretBindingSchema,
} from "./secret-bindings.js";
import { finalizeKeyringDeletions } from "./secrets-migration.js";
import { getConfigurationSecretName } from "./secrets-store.js";
import { withFileTransactionLock } from "./transaction/file-lock.js";
import { createMutex } from "./transaction/mutex.js";
import { createTrustStore, type TrustStore } from "./trust-store.js";
import type {
  ConfigDocumentV1,
  ConfigDocumentV2,
  ConfigurationActionError,
  ConfigurationActionErrorCode,
  SecretsStorageError,
  SecretsStorageErrorCode,
} from "./types.js";
import { CONFIG_SCHEMA_VERSION_V2 } from "./types.js";
import { upgradeV1Documents } from "./v1-upgrade.js";

// Legacy provider-keyed type retained for the V1 compatibility reads. The V2
// action surface is keyed by configuration id and revision, never by provider.

// Log the raw cause (which carries the absolute path) server-side and return a
// path-free message so API clients never receive host paths or filenames.
const persistFailure = (operation: "config" | "secrets", cause: unknown): SecretsStorageError => {
  log("error", "config_persist_failed", { operation, error: getErrorMessage(cause) });
  return createError<SecretsStorageErrorCode>("PERSIST_FAILED", `Failed to persist ${operation}`);
};

const configurationActionFailure = (
  code: ConfigurationActionErrorCode,
  message: string,
): ConfigurationActionError => createError<ConfigurationActionErrorCode>(code, message);

const SUPPORTED_CONFIGURATION_ACTIONS: readonly ClientConfigurationActionName[] = [
  "inspect",
  "select",
  "test",
  "update",
  "delete",
];
const REMOVED_CONFIGURATION_ACTIONS: readonly ClientConfigurationActionName[] = [
  "inspect",
  "delete",
];

/** The budget every configuration is created with, and the limits admission projects from it. */
export const DEFAULT_CONFIGURATION_BUDGET: ConfigurationBudgetLimits = {
  inputTokens: 200_000,
  outputTokens: 40_000,
  responseBytes: 8_000_000,
  wallTimeMs: 300_000,
  retries: 0,
  concurrency: 1,
  perReview: 5,
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

const encodeJsonBytes = (value: unknown): Uint8Array => textEncoder.encode(JSON.stringify(value));
const decodeUtf8Bytes = (bytes: Uint8Array): string => textDecoder.decode(bytes);

const createConfigurationId = (): ConfigurationId => `cfg-${randomUUID()}`;

const literalSecretPath = (configurationId: string, revision: number): string =>
  join(dirname(getGlobalSecretsPath()), "credentials", `${configurationId}-${revision}.key`);

// Admission evidence is server-only and outlives the process: the record keeps
// the reference, the payload lives in a sibling file named by that reference.
const evidenceReferenceFor = (configurationId: string): string => `evidence-${configurationId}`;

const evidencePath = (evidenceReference: string): string =>
  join(dirname(getGlobalConfigPath()), "evidence", `${evidenceReference}.json`);

const keyringStore: KeyringSecretStore = {
  read: (keyId) => {
    const result = readKeyringSecret(keyId);
    if (!result.ok) throw new Error(`Keyring read failed: ${result.error.message}`);
    return result.value;
  },
  write: (keyId, value) => {
    const result = writeKeyringSecret(keyId, value);
    if (!result.ok) throw new Error(`Keyring write failed: ${result.error.message}`);
  },
  delete: (keyId) => {
    const result = deleteKeyringSecret(keyId);
    if (!result.ok) throw new Error(`Keyring delete failed: ${result.error.message}`);
    return result.value;
  },
};

const secretIO: SecretBindingIO = { keyring: keyringStore };

const EMPTY_CONFIG_DOCUMENT: ConfigDocumentV2 = {
  schemaVersion: CONFIG_SCHEMA_VERSION_V2,
  settings: {},
  selectedConfigurationId: null,
  configurations: [],
};

const EMPTY_SECRETS_DOCUMENT: SecretsDocumentV2 = {
  schemaVersion: SECRETS_SCHEMA_VERSION_V2,
  bindings: [],
};

export interface ConfigStore {
  ready(): Promise<Result<void, SecretsStorageError>>;
  getSettings(): SettingsConfig;
  updateSettings(
    patch: Partial<SettingsConfig>,
  ): Promise<Result<SettingsConfig, ConfigurationActionError>>;
  getProjectInfo(projectRoot?: string): ProjectInfo;
  ensureProjectFile(projectRoot: string): ProjectInfo;
  getTrust(projectId: string): TrustConfig | null;
  listTrustedProjects(): TrustConfig[];
  saveTrust(config: TrustConfig): Promise<Result<TrustConfig, SecretsStorageError>>;
  removeTrust(projectId: string): Promise<Result<boolean, SecretsStorageError>>;
  runConfigurationAction(
    action: ClientConfigurationAction,
  ): Promise<Result<ClientConfigurationActionResponse, ConfigurationActionError>>;
  recordConfigurationEvidence(
    configurationId: ConfigurationId,
    evidence: AdmissionEvidence,
  ): Promise<Result<boolean, ConfigurationActionError>>;
  getConfigurationAdmissionEvidence(configurationId: ConfigurationId): AdmissionEvidence | null;
}

// The V2 documents are the whole persisted state: `config.json` holds settings,
// configuration records, and the selection; `secrets.json` holds the credential
// bindings. Both are written by exactly one writer (the V2 codec in
// `persistence/`), under both file locks, journalled by the `.recovery` WAL.
export function createConfigStore(): ConfigStore {
  const trustStore: TrustStore = createTrustStore();
  // Serialize config/secrets mutations so concurrent API calls never interleave at
  // their await points and each observes the previous mutation's settled state.
  const mutex = createMutex();
  // Set only by a failed WAL replay: the prior bytes could not be restored, so
  // `ready()` and every mutation keep failing closed instead of writing over a
  // half-committed pair.
  let startupError: SecretsStorageError | null = null;
  // Set while a V1 document still awaits its upgrade. Reads stay available (the
  // V1 settings are already served) but `ready()` reports it, and every mutation
  // retries the upgrade instead of writing over the V1 file.
  let upgradeError: SecretsStorageError | null = null;

  // --- V2 configuration action orchestration ---------------------------------

  // The V2 documents are reloaded from disk at the start of every action while
  // holding both file locks, so concurrent store instances observe each other's
  // settled writes and stale in-memory state can never resurrect a deleted
  // record or binding. Live admission evidence stays server-side in memory.
  let configDocument: ConfigDocumentV2 = EMPTY_CONFIG_DOCUMENT;
  let secretsDocument: SecretsDocumentV2 = EMPTY_SECRETS_DOCUMENT;
  const evidenceByConfiguration = new Map<string, AdmissionEvidence>();
  let configBytesBeforeMutation: Uint8Array | null = null;
  let secretsBytesBeforeMutation: Uint8Array | null = null;
  // A decoded V1 document waiting for its one-way upgrade. Its settings are
  // already served; its records become V2 records the first time a mutation (or
  // initialization) can hold both file locks.
  let pendingV1Config: ConfigDocumentV1 | null = null;

  const loadFileBytes = (filePath: string): Uint8Array | null => {
    try {
      return new Uint8Array(readFileSync(filePath));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  };

  // Disk is the single source of truth for evidence too: rehydrating here means a
  // restart keeps the readiness the user was shown, and a record whose payload is
  // gone falls back to pending instead of admitting on an unobserved tuple.
  const reloadEvidence = (): void => {
    evidenceByConfiguration.clear();
    for (const entry of configDocument.configurations) {
      if (entry.status !== "supported") continue;
      const record = entry.record;
      // Only the reference this server writes is honoured, so a hand-edited
      // config.json cannot aim the loader at an arbitrary path.
      if (record.evidenceReference !== evidenceReferenceFor(record.configurationId)) continue;
      const read = readJsonFileSyncSafe<unknown>(evidencePath(record.evidenceReference));
      if (read.status !== "ok") continue;
      const parsed = AdmissionEvidenceSchema.safeParse(read.data);
      if (parsed.success) evidenceByConfiguration.set(record.configurationId, parsed.data);
    }
  };

  const removeEvidenceFile = (configurationId: ConfigurationId): void => {
    try {
      removeFileSync(evidencePath(evidenceReferenceFor(configurationId)));
    } catch (cause) {
      log("warn", "config_evidence_delete_failed", { error: getErrorMessage(cause) });
    }
  };

  const clearConfigurationEvidence = (configurationId: ConfigurationId): void => {
    evidenceByConfiguration.delete(configurationId);
    removeEvidenceFile(configurationId);
  };

  const loadDocumentsFromDisk = (): Result<void, ConfigurationActionError> => {
    try {
      configBytesBeforeMutation = loadFileBytes(getGlobalConfigPath());
      secretsBytesBeforeMutation = loadFileBytes(getGlobalSecretsPath());
      const decoded =
        configBytesBeforeMutation === null ? null : decodeConfigFile(configBytesBeforeMutation);
      if (decoded !== null && decoded.schemaVersion !== CONFIG_SCHEMA_VERSION_V2) {
        // Settings are version-independent, so they are served immediately; the
        // records stay empty until the upgrade commits, which keeps every V2
        // action reporting the pending upgrade instead of a half-read document.
        pendingV1Config = decoded;
        configDocument = { ...EMPTY_CONFIG_DOCUMENT, settings: decoded.settings };
        secretsDocument = EMPTY_SECRETS_DOCUMENT;
      } else {
        pendingV1Config = null;
        configDocument = decoded ?? EMPTY_CONFIG_DOCUMENT;
        secretsDocument = loadSecretsV2();
      }
      reloadEvidence();
      return ok(undefined);
    } catch (cause) {
      log("warn", "config_v2_load_failed", { error: getErrorMessage(cause) });
      return err(
        configurationActionFailure(
          "CONFIGURATION_UNSUPPORTED",
          "Configuration file is not supported by this version",
        ),
      );
    }
  };

  // Load the documents (and the evidence they reference) at construction so
  // readiness reads served before the first mutation already reflect disk.
  loadDocumentsFromDisk();

  const persistV2Failure = (cause: unknown): ConfigurationActionError => {
    log("error", "config_v2_persist_failed", { error: getErrorMessage(cause) });
    return configurationActionFailure("PERSIST_FAILED", "Failed to persist configuration");
  };

  /**
   * Commit both documents under the already-held locks. The `.recovery` journal
   * records the exact prior bytes of both files first, so a failure between the
   * two writes — or a crash — restores the pre-mutation pair instead of leaving
   * a record without its binding.
   */
  const writeV2Documents = async (): Promise<Result<void, ConfigurationActionError>> => {
    let journal: DocumentRecoveryRecord;
    try {
      journal = await writeDocumentRecovery({
        config: configBytesBeforeMutation,
        secrets: secretsBytesBeforeMutation,
      });
    } catch (cause) {
      return err(persistV2Failure(cause));
    }

    try {
      await atomicWriteFile(
        getGlobalConfigPath(),
        decodeUtf8Bytes(serializeConfigV2(configDocument)),
        0o600,
      );
      if (secretsDocument.bindings.length === 0) {
        removeFileSync(getGlobalSecretsPath());
      } else {
        await atomicWriteFile(
          getGlobalSecretsPath(),
          decodeUtf8Bytes(serializeSecretsV2(secretsDocument)),
          0o600,
        );
      }
    } catch (cause) {
      const rollbackError = await restoreDocumentRecovery(journal);
      // In-memory documents carry the rejected mutation, so they are re-read
      // from the restored files before any reader is served again.
      loadDocumentsFromDisk();
      if (rollbackError) {
        return err(
          configurationActionFailure(
            "ROLLBACK_FAILED",
            "Failed to roll back configuration changes",
          ),
        );
      }
      return err(persistV2Failure(cause));
    }

    try {
      clearDocumentRecovery();
    } catch (cause) {
      // The pair is committed but the journal survives, so the next startup would
      // undo it. Report the failure instead of claiming a durable commit.
      log("error", "config_recovery_clear_failed", { error: getErrorMessage(cause) });
      return err(
        configurationActionFailure(
          "ROLLBACK_FAILED",
          "Failed to complete the configuration commit",
        ),
      );
    }
    configBytesBeforeMutation = loadFileBytes(getGlobalConfigPath());
    secretsBytesBeforeMutation = loadFileBytes(getGlobalSecretsPath());
    return ok(undefined);
  };

  /**
   * One-way V1 -> V2 upgrade, run under both locks. Credentials are copied to
   * their configuration-keyed destination before the commit and provider-keyed
   * keyring entries are deleted only after it, so an interrupted upgrade is
   * re-runnable and never strands a secret.
   */
  const upgradePendingV1Document = async (): Promise<Result<void, ConfigurationActionError>> => {
    const documentV1 = pendingV1Config;
    if (!documentV1) return ok(undefined);

    const upgraded = upgradeV1Documents(documentV1, loadSecretsV1(), {
      budget: DEFAULT_CONFIGURATION_BUDGET,
      filePathFor: ({ configurationId, revision }) => literalSecretPath(configurationId, revision),
    });
    if (!upgraded.ok) {
      upgradeError = upgraded.error;
      return err(upgraded.error);
    }

    configDocument = upgraded.value.configDocument;
    secretsDocument = upgraded.value.secretsDocument;
    const persisted = await writeV2Documents();
    if (!persisted.ok) {
      upgradeError = createError<SecretsStorageErrorCode>(
        "PERSIST_FAILED",
        "Failed to persist the upgraded configuration",
      );
      return persisted;
    }

    finalizeKeyringDeletions(upgraded.value.keyringDeletions);
    pendingV1Config = null;
    upgradeError = null;
    reloadEvidence();
    log("info", "config_v1_upgraded", { configurations: configDocument.configurations.length });
    return ok(undefined);
  };

  const reloadV2Documents = async (): Promise<Result<void, ConfigurationActionError>> => {
    const loaded = loadDocumentsFromDisk();
    if (!loaded.ok) return loaded;
    return upgradePendingV1Document();
  };

  const runV2Mutation = async <T>(
    operation: () => Promise<Result<T, ConfigurationActionError>>,
  ): Promise<Result<T, ConfigurationActionError>> => {
    if (startupError) return err(startupError);
    try {
      return await mutex.run(() =>
        withFileTransactionLock(getGlobalConfigPath(), () =>
          withFileTransactionLock(getGlobalSecretsPath(), async () => {
            const reloaded = await reloadV2Documents();
            if (!reloaded.ok) return reloaded;
            try {
              return await operation();
            } catch (cause) {
              return err(persistV2Failure(cause));
            }
          }),
        ),
      );
    } catch (cause) {
      return err(persistV2Failure(cause));
    }
  };

  // Replay an interrupted commit, then perform any pending V1 upgrade, before the
  // first request is served. `ready()` resolves once this settles.
  const initialization = mutex.run(async () => {
    try {
      await withFileTransactionLock(getGlobalConfigPath(), () =>
        withFileTransactionLock(getGlobalSecretsPath(), async () => {
          startupError = await reconcileDocumentRecoveryAtStartup();
          if (startupError) return;
          await reloadV2Documents();
        }),
      );
    } catch (cause) {
      startupError = persistFailure("config", cause);
    }
  });
  void initialization.catch((cause: unknown) => {
    log("warn", "startup_reconcile_failed", { error: getErrorMessage(cause) });
  });

  const ready = async (): Promise<Result<void, SecretsStorageError>> => {
    await initialization;
    const failure = startupError ?? upgradeError;
    return failure ? err(failure) : ok(undefined);
  };

  const v2Storage = (): SecretsStorage =>
    configDocument.settings.secretsStorage === "keyring" ? "keyring" : "file";

  const literalBindingOptions = (configurationId: string, revision: number) =>
    v2Storage() === "keyring"
      ? { keyring: keyringStore, keyId: getConfigurationSecretName(configurationId, revision) }
      : { keyring: keyringStore, filePath: literalSecretPath(configurationId, revision) };

  // A client-supplied `environment` credential carries no name; core owns the
  // canonical variable per product, and the setup surfaces preview that name.
  const credentialEnvironmentVariable = (productId: RunnableProductId): string | null =>
    CREDENTIAL_ENV_VARS[productId] ?? null;

  const bindEnvironmentSecret = (
    productId: RunnableProductId,
    configurationId: ConfigurationId,
    revision: ConfigurationRevision,
    localBearer: boolean,
  ): Result<SecretBinding, ConfigurationActionError> => {
    const varName = credentialEnvironmentVariable(productId);
    if (varName === null) {
      return err(
        configurationActionFailure(
          "SECRET_BINDING_FAILED",
          "No canonical environment variable exists for this product",
        ),
      );
    }
    return ok(
      localBearer
        ? createLocalBearerBinding(configurationId, revision, "environment-reference", varName)
        : createEnvironmentSecretBinding(configurationId, revision, varName),
    );
  };

  const secretBindingFailure = (cause: unknown): ConfigurationActionError => {
    log("warn", "config_secret_binding_failed", { error: getErrorMessage(cause) });
    return configurationActionFailure(
      "SECRET_BINDING_FAILED",
      "Secret binding could not be persisted",
    );
  };

  const bindActionSecret = async (
    configurationId: ConfigurationId,
    revision: ConfigurationRevision,
    input: ClientConfigurationInput,
  ): Promise<Result<SecretBinding, ConfigurationActionError>> => {
    try {
      if (input.transportFamily === "local-cli") {
        return ok(createNoneSecretBinding(configurationId, revision));
      }
      if (input.transportFamily === "hosted-api") {
        const credential = input.credential;
        if (!credential) return ok(createNoneSecretBinding(configurationId, revision));
        if (credential.kind === "environment") {
          return bindEnvironmentSecret(input.productId, configurationId, revision, false);
        }
        return ok(
          await bindWriteOnlySecret(configurationId, revision, credential, {
            ...literalBindingOptions(configurationId, revision),
          }),
        );
      }
      if (input.authentication === "none") {
        return ok(createNoneSecretBinding(configurationId, revision));
      }
      const bearerToken = input.bearerToken;
      if (!bearerToken) {
        return err(
          configurationActionFailure(
            "SECRET_BINDING_FAILED",
            "Bearer credential is required for optional local bearer authentication",
          ),
        );
      }
      if (bearerToken.kind === "environment") {
        return bindEnvironmentSecret(input.productId, configurationId, revision, true);
      }
      return ok(
        await bindWriteOnlySecret(configurationId, revision, bearerToken, {
          localBearer: true,
          ...literalBindingOptions(configurationId, revision),
        }),
      );
    } catch (cause) {
      return err(secretBindingFailure(cause));
    }
  };

  const discardBindingSecret = async (binding: SecretBinding): Promise<void> => {
    try {
      await deleteSecretBinding(binding, secretIO);
    } catch (cause) {
      log("warn", "config_binding_rollback_failed", { error: getErrorMessage(cause) });
    }
  };

  const encodeDecodedBinding = (binding: SecretBinding): DecodedSecretBinding => ({
    status: "supported",
    binding,
    rawBytes: encodeJsonBytes(binding),
  });

  const findDecodedRecord = (
    configurationId: ConfigurationId,
  ): DecodedProviderConfigurationRecord | undefined =>
    configDocument.configurations.find((record) =>
      record.status === "unknown"
        ? record.configurationId === configurationId
        : record.record.configurationId === configurationId,
    );

  const replaceRecordInDocument = (
    record: DecodedProviderConfigurationRecord,
    replacement: DecodedProviderConfigurationRecord,
  ): ConfigDocumentV2 => ({
    ...configDocument,
    configurations: configDocument.configurations.map((candidate) =>
      candidate === record ? replacement : candidate,
    ),
  });

  const findBindingForIdentity = (
    configurationId: ConfigurationId,
    revision: ConfigurationRevision,
  ): SecretBinding | null => {
    for (const entry of secretsDocument.bindings) {
      const binding = entry.binding;
      if (binding && binding.configurationId === configurationId && binding.revision === revision) {
        return binding;
      }
    }
    return null;
  };

  const credentialReferenceIdentityFor = (binding: SecretBinding | null): string | null => {
    if (!binding) return null;
    switch (binding.kind) {
      case "none":
        return null;
      case "environment-reference":
        return sha256CanonicalJsonSync({ kind: "environment-reference", varName: binding.varName });
      case "keyring-reference":
        return sha256CanonicalJsonSync({ kind: "keyring-reference", keyId: binding.keyId });
      case "file-0600":
        return sha256CanonicalJsonSync({ kind: "file-0600", filePath: binding.filePath });
      case "optional-local-bearer":
        return sha256CanonicalJsonSync({
          kind: "optional-local-bearer",
          storage: binding.storage,
          reference: binding.reference,
        });
    }
  };

  const workspaceAccountReferenceFor = (
    record: SupportedProviderConfigurationRecord,
  ): string | null => {
    if (record.input.transportFamily !== "hosted-api" || record.input.workspace === undefined) {
      return null;
    }
    return sha256CanonicalJsonSync(record.input.workspace);
  };

  /**
   * Delete the stored secret of every dropped binding row, except where a
   * retained row still resolves through the same reference (a carried-forward
   * credential shares its file or keyring entry with the previous revision).
   * Returns the rows whose material could not be deleted; ENOENT is not a
   * failure, so a returned row means the secret is still on disk.
   */
  const deleteRetiredSecretMaterial = async (
    removed: readonly SecretBinding[],
    retained: readonly DecodedSecretBinding[],
  ): Promise<SecretBinding[]> => {
    const retainedReferences = new Set<string>();
    for (const entry of retained) {
      const reference = credentialReferenceIdentityFor(entry.binding ?? null);
      if (reference !== null) retainedReferences.add(reference);
    }

    const failed: SecretBinding[] = [];
    for (const binding of removed) {
      const reference = credentialReferenceIdentityFor(binding);
      if (reference === null || retainedReferences.has(reference)) continue;
      try {
        await deleteSecretBinding(binding, secretIO);
      } catch (cause) {
        log("warn", "config_binding_delete_failed", { error: getErrorMessage(cause) });
        failed.push(binding);
      }
    }
    return failed;
  };

  const readinessFor = (configuration: ProviderConfigurationRecord | null): Readiness => {
    if (!configuration) return computeProviderReadinessResult({ configuration: null }).readiness;
    if (configuration.status !== "supported") {
      return computeProviderReadinessResult({ configuration }).readiness;
    }
    const binding = findBindingForIdentity(configuration.configurationId, configuration.revision);
    const evidence = evidenceByConfiguration.get(configuration.configurationId) ?? null;
    return computeProviderReadinessResult({
      configuration,
      binding,
      evidence,
      evidenceKey: evidence?.evidenceKey ?? null,
      credentialReferenceIdentity: binding ? credentialReferenceIdentityFor(binding) : null,
      workspaceAccountReference: workspaceAccountReferenceFor(configuration),
    }).readiness;
  };

  const skippedReadiness = (): Readiness =>
    ReadinessSchema.parse({
      status: "skipped",
      ready: false,
      evidenceStatus: "skipped",
      checkedAt: new Date().toISOString(),
      acknowledgement: { status: "not-applicable" },
      ...READINESS_PRESENTATION.skipped,
    });

  const conformanceFailedReadiness = (acknowledgement: ReadinessAcknowledgement): Readiness =>
    ReadinessSchema.parse({
      status: "conformance-failed",
      ready: false,
      evidenceStatus: "failed",
      checkedAt: new Date().toISOString(),
      acknowledgement,
      ...READINESS_PRESENTATION["conformance-failed"],
    });

  const noticesFor = (
    productId: RunnableProductId,
  ): readonly ClientConfigurationNotice[] | null => {
    const parsed = ClientConfigurationNoticeSchema.safeParse({
      ...PRODUCT_REGISTRY[productId].notice,
    });
    return parsed.success ? [parsed.data] : null;
  };

  const summaryForSupportedRecord = (
    record: SupportedProviderConfigurationRecord,
  ): Result<ClientConfigurationSummary, ConfigurationActionError> => {
    const notices = noticesFor(record.productId);
    if (!notices) {
      return err(
        configurationActionFailure(
          "CONFIGURATION_UNSUPPORTED",
          "Configuration cannot be represented at the client boundary",
        ),
      );
    }
    const base = {
      configurationId: record.configurationId,
      revision: record.revision,
      selectedModelId: record.selectedModelId,
      notices,
      availableActions: SUPPORTED_CONFIGURATION_ACTIONS,
    };
    const input = record.input;
    let candidate: Record<string, unknown>;
    switch (input.transportFamily) {
      case "hosted-api":
        candidate = {
          status: "supported",
          transportFamily: "hosted-api",
          productId: record.productId,
          endpoint: input.endpoint,
          ...(input.region !== undefined ? { region: input.region } : {}),
          ...(input.workspace !== undefined ? { workspace: input.workspace } : {}),
          ...base,
        };
        break;
      case "local-http":
        candidate = {
          status: "supported",
          transportFamily: "local-http",
          productId: record.productId,
          endpoint: input.endpoint,
          authentication: input.authentication,
          ...(input.presetId !== undefined ? { presetId: input.presetId } : {}),
          ...base,
        };
        break;
      default:
        candidate = {
          status: "supported",
          transportFamily: "local-cli",
          productId: record.productId,
          installationId: input.installationId,
          ...base,
        };
        break;
    }
    const parsed = ClientConfigurationSummarySchema.safeParse(candidate);
    if (!parsed.success) {
      return err(
        configurationActionFailure(
          "CONFIGURATION_UNSUPPORTED",
          "Configuration cannot be represented at the client boundary",
        ),
      );
    }
    return ok(parsed.data);
  };

  const summaryForRemovedRecord = (
    record: RemovedProviderConfigurationRecord,
  ): Result<ClientConfigurationSummary, ConfigurationActionError> => {
    const parsed = ClientConfigurationSummarySchema.safeParse({
      status: "removed",
      configurationId: record.configurationId,
      revision: record.revision,
      transportFamily: "hosted-api",
      productId: REMOVED_PRODUCT_IDS[0],
      selectedModelId: null,
      notices: [],
      availableActions: REMOVED_CONFIGURATION_ACTIONS,
    });
    if (!parsed.success) {
      return err(
        configurationActionFailure(
          "CONFIGURATION_UNSUPPORTED",
          "Configuration cannot be represented at the client boundary",
        ),
      );
    }
    return ok(parsed.data);
  };

  const succeededActionResponse = <Action extends ClientConfigurationActionName>(
    action: Action,
    payload: {
      configuration?: ClientConfigurationSummary;
      readiness?: Readiness;
      notices?: readonly ClientConfigurationNotice[];
      availableActions?: readonly ClientConfigurationActionName[];
    } = {},
  ): ClientConfigurationActionResponse =>
    ClientConfigurationActionResponseSchema.parse({
      action,
      status: "succeeded",
      ...(payload.configuration !== undefined ? { configuration: payload.configuration } : {}),
      ...(payload.readiness !== undefined ? { readiness: payload.readiness } : {}),
      ...(payload.notices !== undefined ? { notices: [...payload.notices] } : {}),
      ...(payload.availableActions !== undefined
        ? { availableActions: [...payload.availableActions] }
        : {}),
    });

  const toNonSecretInput = (input: ClientConfigurationInput): NonSecretTransportInput => {
    if (input.transportFamily === "hosted-api") {
      return NonSecretTransportInputSchema.parse({
        transportFamily: input.transportFamily,
        productId: input.productId,
        endpoint: input.endpoint,
        ...(input.region !== undefined ? { region: input.region } : {}),
        ...(input.workspace !== undefined ? { workspace: input.workspace } : {}),
      });
    }
    if (input.transportFamily === "local-http") {
      return NonSecretTransportInputSchema.parse({
        transportFamily: input.transportFamily,
        productId: input.productId,
        endpoint: input.endpoint,
        authentication: input.authentication,
        ...(input.presetId !== undefined ? { presetId: input.presetId } : {}),
      });
    }
    return NonSecretTransportInputSchema.parse(input);
  };

  const runCreateAction = async (
    action: Extract<ClientConfigurationAction, { action: "create" }>,
  ): Promise<Result<ClientConfigurationActionResponse, ConfigurationActionError>> => {
    const nonSecretInput = toNonSecretInput(action.input);
    const configurationId = createConfigurationId();
    const now = new Date().toISOString();
    const productId = nonSecretInput.productId;
    const record: SupportedProviderConfigurationRecord = {
      schemaVersion: 2,
      status: "supported",
      configurationId,
      revision: 1,
      transportFamily: nonSecretInput.transportFamily,
      productId,
      input: nonSecretInput,
      selectedModelId: null,
      acknowledgement: {
        noticeVersion: PRODUCT_REGISTRY[productId].notice.noticeVersion,
        acceptedAt: null,
      },
      evidenceReference: null,
      budget: DEFAULT_CONFIGURATION_BUDGET,
      createdAt: now,
      updatedAt: now,
    };
    const summaryResult = summaryForSupportedRecord(record);
    if (!summaryResult.ok) return summaryResult;
    const bindingResult = await bindActionSecret(configurationId, 1, action.input);
    if (!bindingResult.ok) return bindingResult;
    const binding = bindingResult.value;
    configDocument = {
      ...configDocument,
      configurations: [
        ...configDocument.configurations,
        { status: "supported", record, rawBytes: encodeJsonBytes(record) },
      ],
    };
    secretsDocument = {
      ...secretsDocument,
      bindings: [...secretsDocument.bindings, encodeDecodedBinding(binding)],
    };
    const persistResult = await writeV2Documents();
    if (!persistResult.ok) {
      await discardBindingSecret(binding);
      return persistResult;
    }
    const readiness = readinessFor(record);
    return ok(
      succeededActionResponse("create", {
        configuration: summaryResult.value,
        readiness,
        notices: summaryResult.value.notices,
        availableActions: SUPPORTED_CONFIGURATION_ACTIONS,
      }),
    );
  };

  const runInspectAction = async (
    action: Extract<ClientConfigurationAction, { action: "inspect" }>,
  ): Promise<Result<ClientConfigurationActionResponse, ConfigurationActionError>> => {
    const record = findDecodedRecord(action.configurationId);
    if (!record) {
      return err(configurationActionFailure("CONFIGURATION_NOT_FOUND", "Configuration not found"));
    }
    if (record.status === "unknown") {
      return err(
        configurationActionFailure("CONFIGURATION_UNSUPPORTED", "Configuration is not supported"),
      );
    }
    if (record.status === "removed") {
      const summaryResult = summaryForRemovedRecord(record.record);
      if (!summaryResult.ok) return summaryResult;
      return ok(
        succeededActionResponse("inspect", {
          configuration: summaryResult.value,
          readiness: readinessFor(record.record),
          availableActions: REMOVED_CONFIGURATION_ACTIONS,
        }),
      );
    }
    const summaryResult = summaryForSupportedRecord(record.record);
    if (!summaryResult.ok) return summaryResult;
    return ok(
      succeededActionResponse("inspect", {
        configuration: summaryResult.value,
        readiness: readinessFor(record.record),
        notices: summaryResult.value.notices,
        availableActions: SUPPORTED_CONFIGURATION_ACTIONS,
      }),
    );
  };

  const runSelectAction = async (
    action: Extract<ClientConfigurationAction, { action: "select" }>,
  ): Promise<Result<ClientConfigurationActionResponse, ConfigurationActionError>> => {
    const modelId = ExactModelIdSchema.safeParse(action.modelId);
    if (!modelId.success) {
      return err(configurationActionFailure("INVALID_ACTION", "Model id is not an exact model id"));
    }
    const record = findDecodedRecord(action.configurationId);
    if (!record) {
      return err(configurationActionFailure("CONFIGURATION_NOT_FOUND", "Configuration not found"));
    }
    if (record.status !== "supported") {
      return err(
        configurationActionFailure("CONFIGURATION_UNSUPPORTED", "Configuration is not supported"),
      );
    }
    const now = new Date().toISOString();
    const nextRecord: SupportedProviderConfigurationRecord = {
      ...record.record,
      selectedModelId: modelId.data,
      evidenceReference: null,
      updatedAt: now,
    };
    const summaryResult = summaryForSupportedRecord(nextRecord);
    if (!summaryResult.ok) return summaryResult;
    configDocument = selectConfigV2(
      replaceRecordInDocument(record, {
        status: "supported",
        record: nextRecord,
        rawBytes: encodeJsonBytes(nextRecord),
      }),
      action.configurationId,
    );
    clearConfigurationEvidence(action.configurationId);
    const persistResult = await writeV2Documents();
    if (!persistResult.ok) return persistResult;
    const readiness = readinessFor(nextRecord);
    return ok(
      succeededActionResponse("select", {
        configuration: summaryResult.value,
        readiness,
        notices: summaryResult.value.notices,
        availableActions: SUPPORTED_CONFIGURATION_ACTIONS,
      }),
    );
  };

  const conformanceSubjectFor = (
    configurationId: ConfigurationId,
  ): Result<ConfigurationConformanceSubject, ConfigurationActionError> => {
    const record = findDecodedRecord(configurationId);
    if (!record) {
      return err(configurationActionFailure("CONFIGURATION_NOT_FOUND", "Configuration not found"));
    }
    if (record.status !== "supported") {
      return err(
        configurationActionFailure("CONFIGURATION_UNSUPPORTED", "Configuration is not supported"),
      );
    }
    const binding = findBindingForIdentity(configurationId, record.record.revision);
    return ok({
      record: record.record,
      binding,
      credentialReferenceIdentity: credentialReferenceIdentityFor(binding),
      workspaceAccountReference: workspaceAccountReferenceFor(record.record),
    });
  };

  /**
   * An observation that did not pass persists no evidence, so the reprojected
   * readiness is still pending. A probe that ran and failed becomes an observed
   * conformance failure; the intentional-skip readiness is reserved for the
   * observations the probe declined to make (unsupported transport family, no
   * exact model selected, no probe registered). Never passed.
   */
  const observedTestReadiness = (
    readiness: Readiness,
    observation: ConfigurationConformanceObservation,
  ): Readiness => {
    if (readiness.status !== "conformance-pending") return readiness;
    if (observation.status === "failed") {
      return conformanceFailedReadiness(readiness.acknowledgement);
    }
    if (observation.status === "skipped") return skippedReadiness();
    return readiness;
  };

  const projectTestResponse = (
    configurationId: ConfigurationId,
    observation: ConfigurationConformanceObservation,
  ): Result<ClientConfigurationActionResponse, ConfigurationActionError> => {
    const record = findDecodedRecord(configurationId);
    if (!record || record.status !== "supported") {
      return err(configurationActionFailure("CONFIGURATION_NOT_FOUND", "Configuration not found"));
    }
    const summaryResult = summaryForSupportedRecord(record.record);
    if (!summaryResult.ok) return summaryResult;
    return ok(
      ClientConfigurationActionResponseSchema.parse({
        action: "test",
        status: observation.status === "failed" ? "failed" : "succeeded",
        configuration: summaryResult.value,
        readiness: observedTestReadiness(readinessFor(record.record), observation),
        notices: [...summaryResult.value.notices],
        availableActions: [...SUPPORTED_CONFIGURATION_ACTIONS],
      }),
    );
  };

  /**
   * Test observes the configuration's immutable tuple once and reprojects
   * readiness from whatever evidence that observation persisted. The probe runs
   * between two short transactions, never while the config/secrets locks are
   * held, so a bounded network observation cannot block other mutations. A
   * failed observation is logged with its credential-safe reason — the response
   * vocabulary carries no free-text field — and reported as a failed action.
   */
  const runTestAction = async (
    action: Extract<ClientConfigurationAction, { action: "test" }>,
  ): Promise<Result<ClientConfigurationActionResponse, ConfigurationActionError>> => {
    const configurationId = action.configurationId;
    const subject = await runV2Mutation(async () => conformanceSubjectFor(configurationId));
    if (!subject.ok) return subject;

    const observation = await runConfigurationConformance(subject.value, {
      recordConfigurationEvidence,
    });
    if (observation.status === "failed") {
      log("warn", "config_conformance_failed", { configurationId, reason: observation.reason });
    }

    return runV2Mutation(async () => projectTestResponse(configurationId, observation));
  };

  const secretInputFor = (input: ClientConfigurationInput): WriteOnlySecretInput | undefined => {
    if (input.transportFamily === "hosted-api") return input.credential;
    if (input.transportFamily === "local-http") return input.bearerToken;
    return undefined;
  };

  const bindingIsAbsentFor = (input: ClientConfigurationInput): boolean =>
    input.transportFamily === "local-cli" ||
    (input.transportFamily === "local-http" && input.authentication === "none");

  const runUpdateAction = async (
    action: Extract<ClientConfigurationAction, { action: "update" }>,
  ): Promise<Result<ClientConfigurationActionResponse, ConfigurationActionError>> => {
    const configurationId = action.configurationId;
    const record = findDecodedRecord(configurationId);
    if (!record) {
      return err(configurationActionFailure("CONFIGURATION_NOT_FOUND", "Configuration not found"));
    }
    if (record.status !== "supported") {
      return err(
        configurationActionFailure("CONFIGURATION_UNSUPPORTED", "Configuration is not supported"),
      );
    }
    if (record.record.revision !== action.expectedRevision) {
      return err(
        configurationActionFailure("CONFIGURATION_CONFLICT", "Configuration revision conflict"),
      );
    }
    const product = PRODUCT_REGISTRY[record.record.productId];
    if (
      action.acknowledgement.noticeId !== product.notice.id ||
      action.acknowledgement.noticeVersion !== product.notice.noticeVersion
    ) {
      return err(
        configurationActionFailure(
          "CONFIGURATION_CONFLICT",
          "Notice acknowledgement does not match the product",
        ),
      );
    }
    const nonSecretInput = toNonSecretInput(action.input);
    const now = new Date().toISOString();
    const nextRecord: SupportedProviderConfigurationRecord = {
      ...record.record,
      revision: record.record.revision + 1,
      transportFamily: nonSecretInput.transportFamily,
      productId: nonSecretInput.productId,
      input: nonSecretInput,
      acknowledgement: { noticeVersion: action.acknowledgement.noticeVersion, acceptedAt: now },
      evidenceReference: null,
      updatedAt: now,
    };
    const summaryResult = summaryForSupportedRecord(nextRecord);
    if (!summaryResult.ok) return summaryResult;

    const previousBinding = findBindingForIdentity(configurationId, record.record.revision);
    const secretInput = secretInputFor(action.input);
    const bindingResult =
      secretInput !== undefined
        ? await bindActionSecret(configurationId, nextRecord.revision, action.input)
        : ok<SecretBinding | undefined>(undefined);
    if (!bindingResult.ok) return bindingResult;
    const newBinding = bindingResult.value;

    const replacedBindings: SecretBinding[] = [];
    let nextBindings = secretsDocument.bindings.filter((entry) => {
      const binding = entry.binding;
      const replaced =
        binding &&
        binding.configurationId === configurationId &&
        binding.revision === record.record.revision;
      if (replaced) replacedBindings.push(binding);
      return !replaced;
    });
    if (newBinding !== undefined) {
      nextBindings = [...nextBindings, encodeDecodedBinding(newBinding)];
    } else if (bindingIsAbsentFor(action.input)) {
      const noneBinding = createNoneSecretBinding(configurationId, nextRecord.revision);
      nextBindings = [...nextBindings, encodeDecodedBinding(noneBinding)];
    } else if (action.input.transportFamily === "local-http") {
      return err(
        configurationActionFailure(
          "SECRET_BINDING_FAILED",
          "Bearer credential is required for optional local bearer authentication",
        ),
      );
    } else if (previousBinding) {
      const carried = SecretBindingSchema.parse({
        ...previousBinding,
        revision: nextRecord.revision,
      });
      nextBindings = [...nextBindings, encodeDecodedBinding(carried)];
    } else {
      const noneBinding = createNoneSecretBinding(configurationId, nextRecord.revision);
      nextBindings = [...nextBindings, encodeDecodedBinding(noneBinding)];
    }

    configDocument = replaceRecordInDocument(record, {
      status: "supported",
      record: nextRecord,
      rawBytes: encodeJsonBytes(nextRecord),
    });
    secretsDocument = { ...secretsDocument, bindings: nextBindings };
    clearConfigurationEvidence(configurationId);
    const persistResult = await writeV2Documents();
    if (!persistResult.ok) {
      if (newBinding !== undefined) await discardBindingSecret(newBinding);
      return persistResult;
    }
    // Rotation drops the previous revision's row; its secret material must go
    // with it unless the new row still points at the same reference.
    await deleteRetiredSecretMaterial(replacedBindings, nextBindings);
    const readiness = readinessFor(nextRecord);
    return ok(
      succeededActionResponse("update", {
        configuration: summaryResult.value,
        readiness,
        notices: summaryResult.value.notices,
        availableActions: SUPPORTED_CONFIGURATION_ACTIONS,
      }),
    );
  };

  const runDeleteAction = async (
    action: Extract<ClientConfigurationAction, { action: "delete" }>,
  ): Promise<Result<ClientConfigurationActionResponse, ConfigurationActionError>> => {
    const configurationId = action.configurationId;
    const record = findDecodedRecord(configurationId);
    if (!record) {
      return err(configurationActionFailure("CONFIGURATION_NOT_FOUND", "Configuration not found"));
    }
    if (record.status === "unknown") {
      return err(
        configurationActionFailure("CONFIGURATION_UNSUPPORTED", "Configuration is not supported"),
      );
    }
    if (record.record.revision !== action.expectedRevision) {
      return err(
        configurationActionFailure("CONFIGURATION_CONFLICT", "Configuration revision conflict"),
      );
    }
    const leaseHooks = getConfigSeams().leaseHooks;
    if (!leaseHooks) {
      log("error", "configuration_lease_hooks_not_registered");
      return err(
        configurationActionFailure(
          "SECRET_BINDING_FAILED",
          "Configuration leases cannot be released",
        ),
      );
    }
    await leaseHooks.revoke(configurationId);
    await leaseHooks.cancel(configurationId);
    await leaseHooks.drain(configurationId);
    const bindingsToDelete: SecretBinding[] = [];
    for (const entry of secretsDocument.bindings) {
      const binding = entry.binding;
      if (!binding || binding.configurationId !== configurationId) continue;
      bindingsToDelete.push(binding);
    }
    configDocument = {
      ...configDocument,
      configurations: configDocument.configurations.filter(
        (candidate) =>
          (candidate.status === "unknown"
            ? candidate.configurationId
            : candidate.record.configurationId) !== configurationId,
      ),
      selectedConfigurationId:
        configDocument.selectedConfigurationId === configurationId
          ? null
          : configDocument.selectedConfigurationId,
    };
    secretsDocument = {
      ...secretsDocument,
      bindings: secretsDocument.bindings.filter((entry) => {
        const binding = entry.binding;
        return !binding || binding.configurationId !== configurationId;
      }),
    };
    clearConfigurationEvidence(configurationId);
    const persistResult = await writeV2Documents();
    if (!persistResult.ok) return persistResult;
    const undeleted = await deleteRetiredSecretMaterial(bindingsToDelete, secretsDocument.bindings);
    // The records are gone, but credential material that survived the delete is
    // unreferenced and unretryable. Report the delete as failed so the caller
    // can retry instead of trusting a credential that is still readable.
    if (undeleted.length > 0) {
      return ok(
        ClientConfigurationActionResponseSchema.parse({ action: "delete", status: "failed" }),
      );
    }
    return ok(succeededActionResponse("delete"));
  };

  const limitsMatchBudget = (limits: ExecutionLimits, budget: ConfigurationBudgetLimits): boolean =>
    limits.maxInputTokens === budget.inputTokens &&
    limits.maxOutputTokens === budget.outputTokens &&
    limits.maxResponseBytes === budget.responseBytes &&
    limits.wallTimeMs === budget.wallTimeMs &&
    limits.maxRetries === budget.retries &&
    limits.maxConcurrency === budget.concurrency &&
    limits.maxCostUsd === budget.perReview;

  const evidenceKeyMatchesRecord = (
    record: SupportedProviderConfigurationRecord,
    key: EvidenceKey,
  ): boolean => {
    const expectedEndpoint =
      record.input.transportFamily === "local-cli" ? null : record.input.endpoint;
    const expectedRegion =
      record.input.transportFamily === "hosted-api" ? (record.input.region ?? null) : null;
    return (
      key.productId === record.productId &&
      key.transportFamily === record.transportFamily &&
      key.normalizedEndpoint === expectedEndpoint &&
      key.region === expectedRegion &&
      key.modelId === record.selectedModelId &&
      key.workspaceAccountReference === workspaceAccountReferenceFor(record) &&
      key.credentialReferenceIdentity ===
        credentialReferenceIdentityFor(
          findBindingForIdentity(record.configurationId, record.revision),
        ) &&
      key.authentication ===
        (record.input.transportFamily === "local-http" ? record.input.authentication : null) &&
      key.installationId ===
        (record.input.transportFamily === "local-cli" ? record.input.installationId : null) &&
      limitsMatchBudget(key.limits, record.budget)
    );
  };

  const runRecordEvidence = async (
    configurationId: ConfigurationId,
    evidence: AdmissionEvidence,
  ): Promise<Result<boolean, ConfigurationActionError>> => {
    const parsed = AdmissionEvidenceSchema.safeParse(evidence);
    if (!parsed.success) {
      return err(configurationActionFailure("INVALID_ACTION", "Invalid admission evidence"));
    }
    const record = findDecodedRecord(configurationId);
    if (!record) {
      return err(configurationActionFailure("CONFIGURATION_NOT_FOUND", "Configuration not found"));
    }
    if (record.status !== "supported") {
      return err(
        configurationActionFailure("CONFIGURATION_UNSUPPORTED", "Configuration is not supported"),
      );
    }
    if (!evidenceKeyMatchesRecord(record.record, parsed.data.evidenceKey)) {
      return err(
        configurationActionFailure(
          "CONFIGURATION_CONFLICT",
          "Admission evidence does not match the configuration",
        ),
      );
    }
    const now = new Date().toISOString();
    const evidenceReference = evidenceReferenceFor(configurationId);
    const nextRecord: SupportedProviderConfigurationRecord = {
      ...record.record,
      evidenceReference,
      updatedAt: now,
    };
    // Persist the payload before the record that references it, and take it back
    // if the record never commits, so the two can never disagree.
    try {
      await writeJsonFile(evidencePath(evidenceReference), parsed.data, 0o600);
    } catch (cause) {
      return err(persistV2Failure(cause));
    }
    configDocument = replaceRecordInDocument(record, {
      status: "supported",
      record: nextRecord,
      rawBytes: encodeJsonBytes(nextRecord),
    });
    const persistResult = await writeV2Documents();
    if (!persistResult.ok) {
      removeEvidenceFile(configurationId);
      return persistResult;
    }
    evidenceByConfiguration.set(configurationId, parsed.data);
    return ok(true);
  };

  const runConfigurationAction = (
    action: ClientConfigurationAction,
  ): Promise<Result<ClientConfigurationActionResponse, ConfigurationActionError>> => {
    const parsedAction = ClientConfigurationActionSchema.safeParse(action);
    if (!parsedAction.success) {
      return Promise.resolve(
        err(configurationActionFailure("INVALID_ACTION", "Invalid configuration action")),
      );
    }
    const validAction = parsedAction.data;
    // Test owns its own transactions: the bounded conformance observation runs
    // between them instead of inside the held locks.
    if (validAction.action === "test") return runTestAction(validAction);

    return runV2Mutation(async () => {
      switch (validAction.action) {
        case "create":
          return runCreateAction(validAction);
        case "inspect":
          return runInspectAction(validAction);
        case "select":
          return runSelectAction(validAction);
        case "update":
          return runUpdateAction(validAction);
        case "delete":
          return runDeleteAction(validAction);
      }
    });
  };

  const recordConfigurationEvidence = (
    configurationId: ConfigurationId,
    evidence: AdmissionEvidence,
  ): Promise<Result<boolean, ConfigurationActionError>> =>
    runV2Mutation(() => runRecordEvidence(configurationId, evidence));

  const getConfigurationAdmissionEvidence = (
    configurationId: ConfigurationId,
  ): AdmissionEvidence | null => evidenceByConfiguration.get(configurationId) ?? null;

  // --- Settings -------------------------------------------------------------

  const getSettings = (): SettingsConfig => parseSettingsRecord(configDocument.settings).settings;

  /**
   * `secretsStorage` selects where a NEW credential is written. Existing
   * bindings name their own storage (file path or keyring id), so switching it
   * never moves, rewrites, or invalidates the credentials already bound.
   */
  const updateSettings = (
    patch: Partial<SettingsConfig>,
  ): Promise<Result<SettingsConfig, ConfigurationActionError>> =>
    runV2Mutation(async () => {
      const current = parseSettingsRecord(configDocument.settings);
      const nextSettings: SettingsConfig = { ...current.settings, ...patch };

      if (current.settings.secretsStorage !== null && nextSettings.secretsStorage === null) {
        return err(
          configurationActionFailure(
            "STORAGE_NOT_CONFIGURED",
            "Secrets storage cannot be cleared after configuration",
          ),
        );
      }
      if (nextSettings.secretsStorage === "keyring" && !isKeyringAvailable()) {
        return err(
          configurationActionFailure("KEYRING_UNAVAILABLE", "Keyring storage is not available"),
        );
      }

      configDocument = {
        ...configDocument,
        settings: { ...current.unknown, ...SettingsConfigSchema.parse(nextSettings) },
      };
      const persisted = await writeV2Documents();
      if (!persisted.ok) return persisted;
      return ok(getSettings());
    });

  const resolveRoot = (projectRoot?: string): string =>
    resolveProjectRoot({
      header: projectRoot ?? null,
      env: process.env.DIFFGAZER_PROJECT_ROOT ?? null,
      cwd: process.cwd(),
    });

  const onProjectMove = (oldRepoRoot: string, newRepoRoot: string): Promise<boolean> =>
    getConfigSeams().reviewRekeyHandler(oldRepoRoot, newRepoRoot);

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

  return {
    ready,
    getSettings,
    updateSettings,
    getProjectInfo,
    ensureProjectFile,
    getTrust: trustStore.getTrust,
    listTrustedProjects: trustStore.listTrustedProjects,
    saveTrust: trustStore.saveTrust,
    removeTrust: trustStore.removeTrust,
    runConfigurationAction,
    recordConfigurationEvidence,
    getConfigurationAdmissionEvidence,
  };
}

// Lazy singleton — avoids filesystem reads at import time.
let _store: ConfigStore | null = null;

export function getStore(): ConfigStore {
  if (!_store) _store = createConfigStore();
  return _store;
}
