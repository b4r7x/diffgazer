import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { createError } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import {
  ConfigurationIdSchema,
  ConfigurationRevisionSchema,
  type SecretsStorage,
} from "@diffgazer/core/schemas/config";
import { log } from "../log.js";
import {
  deleteKeyringSecret,
  isKeyringAvailable,
  readKeyringSecret,
  writeKeyringSecret,
} from "./keyring.js";
import {
  createEnvironmentSecretBinding,
  createFileSecretBinding,
  createKeyringSecretBinding,
  createNoneSecretBinding,
  markSecretBindingRemoved,
  type SecretBinding,
  SecretBindingSchema,
} from "./secret-bindings.js";
import { getConfigurationSecretName } from "./secrets-store.js";
import type {
  ConfigState,
  EnvCredentialRef,
  SecretEntry,
  SecretsState,
  SecretsStorageError,
  SecretsStorageErrorCode,
} from "./types.js";

export const getApiKeyName = (provider: string): string => `api_key_${provider}`;

export interface KeyringWriteRollback {
  providerId: string;
  previousValue: string | null;
}

export function rollbackKeyringWrites(
  entries: readonly KeyringWriteRollback[],
): Result<void, SecretsStorageError> {
  let failed = false;
  for (const entry of entries) {
    const result =
      entry.previousValue === null
        ? deleteKeyringSecret(getApiKeyName(entry.providerId))
        : writeKeyringSecret(getApiKeyName(entry.providerId), entry.previousValue);
    if (!result.ok) {
      failed = true;
      log("warn", "keyring_rollback_write_failed", {
        providerId: entry.providerId,
        error: result.error.message,
      });
    }
  }
  return failed
    ? err(
        createError<SecretsStorageErrorCode>(
          "ROLLBACK_FAILED",
          "Failed to restore keyring state after a migration failure",
        ),
      )
    : ok(undefined);
}

/**
 * Writes each literal secret to the keyring, verifying it by read-back, and
 * rolls every write back if any step fails. A rollback failure takes precedence
 * over the error that triggered it.
 */
function writeVerifiedKeyringSecrets(
  entries: ReadonlyArray<readonly [providerId: string, apiKey: string]>,
): Result<KeyringWriteRollback[], SecretsStorageError> {
  const written: KeyringWriteRollback[] = [];
  for (const [providerId, apiKey] of entries) {
    const previousResult = readKeyringSecret(getApiKeyName(providerId));
    if (!previousResult.ok) {
      const rollbackResult = rollbackKeyringWrites(written);
      return rollbackResult.ok ? previousResult : rollbackResult;
    }

    written.push({ providerId, previousValue: previousResult.value });

    const writeResult = writeKeyringSecret(getApiKeyName(providerId), apiKey);
    if (!writeResult.ok) {
      const rollbackResult = rollbackKeyringWrites(written);
      return rollbackResult.ok ? writeResult : rollbackResult;
    }

    const verifyResult = readKeyringSecret(getApiKeyName(providerId));
    if (!verifyResult.ok || verifyResult.value !== apiKey) {
      const failure = err<SecretsStorageError>(
        createError<SecretsStorageErrorCode>(
          "SECRETS_MIGRATION_FAILED",
          `Keyring read-back verification failed for provider '${providerId}'`,
        ),
      );
      const rollbackResult = rollbackKeyringWrites(written);
      return rollbackResult.ok ? failure : rollbackResult;
    }
  }
  return ok(written);
}

export interface MigrationResult {
  nextSecrets: SecretsState;
  /**
   * Provider IDs whose keyring entries must be deleted AFTER the file copy of
   * the secrets has been durably persisted. The caller is responsible for
   * invoking the keyring deletion only once `persistFileSecrets` has succeeded.
   * If a crash occurs between persist and keyring deletion the file already
   * holds the secret and the stale keyring entry is finalized at the next store
   * creation via `findOrphanedKeyringEntries` + `finalizeKeyringDeletions`.
   */
  keyringDeletions: readonly string[];
  keyringWrites: readonly KeyringWriteRollback[];
}

export function migrateSecretsStorage(
  configState: ConfigState,
  secretsState: SecretsState,
  fromStorage: SecretsStorage,
  toStorage: SecretsStorage,
): Result<MigrationResult, SecretsStorageError> {
  if (fromStorage === toStorage) {
    return ok({
      nextSecrets: secretsState,
      keyringDeletions: [],
      keyringWrites: [],
    });
  }

  if (fromStorage === "file" && toStorage === "keyring") {
    if (!isKeyringAvailable()) {
      return err(
        createError<SecretsStorageErrorCode>(
          "KEYRING_UNAVAILABLE",
          "System keyring is not available",
        ),
      );
    }

    const envEntries: Record<string, EnvCredentialRef> = {};
    const literalEntries: [string, string][] = [];
    for (const [providerId, entry] of Object.entries(secretsState.providers)) {
      if (typeof entry === "string") {
        literalEntries.push([providerId, entry]);
      } else {
        envEntries[providerId] = entry;
      }
    }

    const writeResult = writeVerifiedKeyringSecrets(literalEntries);
    if (!writeResult.ok) return writeResult;

    return ok({
      nextSecrets: {
        providers: envEntries,
        ...(secretsState.unknownSecrets ? { unknownSecrets: secretsState.unknownSecrets } : {}),
      },
      keyringDeletions: [],
      keyringWrites: writeResult.value,
    });
  }

  if (fromStorage === "keyring" && toStorage === "file") {
    const nextSecrets: SecretsState["providers"] = {};
    // Preserve env entries that are already in the file (they don't live in keyring)
    for (const [providerId, entry] of Object.entries(secretsState.providers)) {
      if (typeof entry !== "string" && entry.kind === "env") {
        nextSecrets[providerId] = entry;
      }
    }
    const keyringMigrated: string[] = [];
    for (const provider of configState.providers) {
      if (!provider.hasApiKey) continue;
      if (nextSecrets[provider.provider]) continue;
      const secretResult = readKeyringSecret(getApiKeyName(provider.provider));
      if (!secretResult.ok) return secretResult;
      if (secretResult.value === null) {
        return err(
          createError<SecretsStorageErrorCode>(
            "SECRET_NOT_FOUND",
            `Secret for provider '${provider.provider}' not found in keyring`,
          ),
        );
      }
      nextSecrets[provider.provider] = secretResult.value;
      keyringMigrated.push(provider.provider);
    }

    return ok({
      nextSecrets: {
        providers: nextSecrets,
        ...(secretsState.unknownSecrets ? { unknownSecrets: secretsState.unknownSecrets } : {}),
      },
      keyringDeletions: keyringMigrated,
      keyringWrites: [],
    });
  }

  return ok({
    nextSecrets: secretsState,
    keyringDeletions: [],
    keyringWrites: [],
  });
}

/**
 * Deletes the keyring entries returned by a `keyring→file` migration. Must be
 * invoked AFTER the new file copy of the secrets has been durably persisted.
 */
export function finalizeKeyringDeletions(keyringDeletions: readonly string[]): void {
  for (const providerId of keyringDeletions) {
    const deleteResult = deleteKeyringSecret(getApiKeyName(providerId));
    if (!deleteResult.ok) {
      log("warn", "keyring_delete_failed", {
        providerId,
        error: deleteResult.error.message,
      });
    }
  }
}

export interface KeyringReconciliation {
  /** Secrets state with the literal entries that were moved into the keyring removed. */
  nextSecrets: SecretsState;
  /** Provider ids whose literal file entry was written to the keyring. */
  migrated: string[];
}

/**
 * Completes an interrupted file→keyring migration at startup (F-449): when the
 * effective storage is "keyring" but secrets.json still holds literal (non-env)
 * entries — left there by a crash between writing config and clearing the file —
 * write each literal to the keyring (verify, with rollback on failure) and drop
 * it from the returned secrets state. Env references stay in the file because
 * they never live in the keyring. Returns `null` when there is nothing to
 * reconcile so the caller can skip the rewrite.
 */
export function reconcileKeyringSecrets(
  secretsState: SecretsState,
): Result<KeyringReconciliation | null, SecretsStorageError> {
  const literalEntries: [string, string][] = [];
  const nextProviders: SecretsState["providers"] = {};
  for (const [providerId, entry] of Object.entries(secretsState.providers)) {
    if (typeof entry === "string") {
      literalEntries.push([providerId, entry]);
    } else {
      nextProviders[providerId] = entry;
    }
  }
  if (literalEntries.length === 0) return ok(null);

  const writeResult = writeVerifiedKeyringSecrets(literalEntries);
  if (!writeResult.ok) return writeResult;

  const migrated = literalEntries.map(([providerId]) => providerId);

  return ok({
    nextSecrets: {
      providers: nextProviders,
      ...(secretsState.unknownSecrets ? { unknownSecrets: secretsState.unknownSecrets } : {}),
    },
    migrated,
  });
}

/**
 * Completes an interrupted keyring→file migration at startup (F-449). The
 * explicit file setting is the recovery marker, and each provider must also
 * have its completed copy in secrets.json before its keyring entry is orphaned.
 * Returns the provider ids whose stale keyring entry should be finalized so the
 * caller can `finalizeKeyringDeletions` them. Only providers known to the config
 * are probed, so this never prompts the OS keyring for providers it never used.
 */
export function findOrphanedKeyringEntries(
  configState: ConfigState,
  secretsState: SecretsState,
): Result<readonly string[], SecretsStorageError> {
  if (configState.settings.secretsStorage !== "file") return ok([]);
  if (!isKeyringAvailable()) return ok([]);

  const orphans: string[] = [];
  for (const provider of configState.providers) {
    if (!Object.hasOwn(secretsState.providers, provider.provider)) continue;
    const result = readKeyringSecret(getApiKeyName(provider.provider));
    if (!result.ok) return result;
    if (result.value !== null) orphans.push(provider.provider);
  }
  return ok(orphans);
}

// Delete keyring entries shadowed by an env sidecar ref: reads resolve the
// sidecar env ref first, so a stale `api_key_<provider>` from an interrupted literal->env
// switch would linger unreferenced. Keyring mode only, probing env-sidecar providers.
export const deleteShadowedKeyringEntries = (secrets: SecretsState): void => {
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

// ---------------------------------------------------------------------------
// V1 -> V2 configuration-bound secret migration
// ---------------------------------------------------------------------------

/** The only V1 records that may become an executable V2 binding. */
const MIGRATABLE_V1_PROVIDERS = new Set(["gemini", "zai", "openrouter", "groq", "cerebras"]);

/**
 * The V1 provider record does not contain a configuration identity.  T-030
 * supplies this explicit mapping during migration; accepting no implicit
 * provider->configuration fallback is what keeps credentials isolated.
 */
export interface LegacySecretConfiguration {
  readonly provider: string;
  readonly configurationId: string;
  readonly revision: number;
  /** A removed V1 record is retained, never made executable. */
  readonly status?: "supported" | "removed";
  /** Existing provider-keyed keyring name, when the V1 setting used keyring. */
  readonly legacyKeyringName?: string;
  /** Existing file reference, when a caller has already split a V1 file. */
  readonly legacyFilePath?: string;
}

export interface V1SecretMigrationOptions {
  readonly storage: Exclude<SecretsStorage, null>;
  /** Destination file for a literal file-backed secret. */
  readonly filePathFor?: (identity: {
    readonly configurationId: string;
    readonly revision: number;
  }) => string;
  /** Existing bindings from a partially committed migration. */
  readonly existingBindings?: readonly SecretBinding[];
}

export interface V1SecretBindingMigration {
  readonly configurationId: string;
  readonly revision: number;
  readonly provider: string;
  readonly binding: SecretBinding;
}

export interface V1SecretMigrationResult {
  /** New V2 bindings contain references only; never literal values. */
  readonly bindings: readonly SecretBinding[];
  /** Removed/unknown legacy records remain named and untouched. */
  readonly retainedLegacy: readonly V1SecretBindingMigration[];
  /** Keyring deletions are deferred until the V2 file transaction commits. */
  readonly keyringDeletions: readonly string[];
  readonly migrated: readonly V1SecretBindingMigration[];
}

const migrationFailure = (message: string): Result<never, SecretsStorageError> =>
  err(createError<SecretsStorageErrorCode>("SECRETS_MIGRATION_FAILED", message));

const providerSecretEntries = (
  state: SecretsState | Readonly<Record<string, SecretEntry>>,
): Readonly<Record<string, SecretEntry>> => {
  if (
    typeof state === "object" &&
    state !== null &&
    Object.hasOwn(state, "providers") &&
    typeof (state as { readonly providers?: unknown }).providers === "object"
  ) {
    return (state as SecretsState).providers;
  }
  return state as Readonly<Record<string, SecretEntry>>;
};

const bindingForLegacyEntry = (
  item: LegacySecretConfiguration,
  entry: SecretEntry | undefined,
  options: V1SecretMigrationOptions,
  removed: boolean,
): Result<SecretBinding, SecretsStorageError> => {
  const { configurationId, revision } = item;
  if (entry && typeof entry !== "string") {
    const binding = createEnvironmentSecretBinding(
      configurationId,
      revision,
      entry.varName,
      removed ? "removed" : "active",
    );
    return ok(binding);
  }

  if (options.storage === "keyring") {
    const keyId = item.legacyKeyringName ?? getApiKeyName(item.provider);
    const binding = createKeyringSecretBinding(
      configurationId,
      revision,
      keyId,
      removed ? "removed" : "active",
    );
    return ok(binding);
  }

  const filePath = item.legacyFilePath ?? options.filePathFor?.({ configurationId, revision });
  if (filePath) {
    return ok(
      createFileSecretBinding(configurationId, revision, filePath, removed ? "removed" : "active"),
    );
  }

  // A missing V1 value is represented explicitly as `none`.  A removed
  // record is still retained as removed so that it cannot become executable.
  return ok(
    removed
      ? markSecretBindingRemoved(createNoneSecretBinding(configurationId, revision))
      : createNoneSecretBinding(configurationId, revision),
  );
};

const validateMigrationIdentity = (item: LegacySecretConfiguration): string | null => {
  if (!ConfigurationIdSchema.safeParse(item.configurationId).success) {
    return "Legacy secret migration requires a valid configuration id";
  }
  if (!ConfigurationRevisionSchema.safeParse(item.revision).success) {
    return "Legacy secret migration requires a positive configuration revision";
  }
  return null;
};

interface KeyringMutation {
  readonly key: string;
  readonly previousValue: string | null;
}

const rollbackConfigurationKeyringWrites = (
  writes: readonly KeyringMutation[],
): Result<void, SecretsStorageError> => {
  let failed = false;
  for (const write of writes) {
    const result =
      write.previousValue === null
        ? deleteKeyringSecret(write.key)
        : writeKeyringSecret(write.key, write.previousValue);
    if (!result.ok) {
      failed = true;
      log("warn", "configuration_secret_migration_rollback_failed", {
        error: result.error.message,
      });
    }
  }
  return failed
    ? migrationFailure("Failed to restore keyring state after a secret migration failure")
    : ok(undefined);
};

const ensureKeyringCopy = (
  sourceKey: string,
  destinationKey: string,
  value: string,
  writes: KeyringMutation[],
): Result<void, SecretsStorageError> => {
  const destination = readKeyringSecret(destinationKey);
  if (!destination.ok) return destination;
  if (destination.value !== null && destination.value !== value) {
    return migrationFailure("A configuration binding already contains a different secret");
  }
  if (destination.value === null) {
    const previous = readKeyringSecret(destinationKey);
    if (!previous.ok) return previous;
    const write = writeKeyringSecret(destinationKey, value);
    if (!write.ok) return write;
    const verified = readKeyringSecret(destinationKey);
    if (!verified.ok) return verified;
    if (verified.value !== value) {
      return migrationFailure("Configuration secret keyring verification failed");
    }
    writes.push({ key: destinationKey, previousValue: previous.value });
  }

  // A source and destination that are the same key are already idempotent and
  // must not be deleted as part of migration.
  if (sourceKey !== destinationKey) {
    // Deletion is deliberately returned to the caller after persistence, never
    // performed while constructing the V2 binding.
    return ok(undefined);
  }
  return ok(undefined);
};

/**
 * Convert explicitly mapped V1 provider secrets to V2 configuration bindings.
 *
 * Literal values are used only for a one-way keyring/file copy and are never
 * present in the result.  No endpoint, model, conformance probe, or provider
 * adapter is invoked.  `zai-coding` is retained as a removed binding and is
 * intentionally excluded from all copy/delete operations.
 */
export function migrateV1SecretsToBindings(
  state: SecretsState | Readonly<Record<string, SecretEntry>>,
  configurations: readonly LegacySecretConfiguration[],
  options: V1SecretMigrationOptions,
): Result<V1SecretMigrationResult, SecretsStorageError> {
  const entries = providerSecretEntries(state);
  const seen = new Set<string>();
  const bindings: SecretBinding[] = [];
  const retainedLegacy: V1SecretBindingMigration[] = [];
  const migrated: V1SecretBindingMigration[] = [];
  const keyringDeletions: string[] = [];
  const keyringWrites: KeyringMutation[] = [];

  for (const item of configurations) {
    const identityError = validateMigrationIdentity(item);
    if (identityError) {
      const rollback = rollbackConfigurationKeyringWrites(keyringWrites);
      return rollback.ok ? migrationFailure(identityError) : rollback;
    }
    const identityKey = `${item.configurationId}\u0000${item.revision}`;
    if (seen.has(identityKey)) {
      const rollback = rollbackConfigurationKeyringWrites(keyringWrites);
      return rollback.ok
        ? migrationFailure("Duplicate configuration secret binding identity")
        : rollback;
    }
    seen.add(identityKey);

    const entry = entries[item.provider];
    const removed = item.provider === "zai-coding" || item.status === "removed";
    const bindingResult = bindingForLegacyEntry(item, entry, options, removed);
    if (!bindingResult.ok) {
      const rollback = rollbackConfigurationKeyringWrites(keyringWrites);
      return rollback.ok ? bindingResult : rollback;
    }
    let binding = bindingResult.value;

    // Removed records are an explicit retention boundary.  In particular, a
    // zai-coding key is never read, copied, relabelled, tested, or deleted.
    if (removed) {
      const retained = {
        configurationId: item.configurationId,
        revision: item.revision,
        provider: item.provider,
        binding,
      } satisfies V1SecretBindingMigration;
      bindings.push(binding);
      retainedLegacy.push(retained);
      continue;
    }

    if (!MIGRATABLE_V1_PROVIDERS.has(item.provider)) {
      // Unknown providers are preserved as non-executable opaque records by
      // the V1 decoder; this function must not invent a product alias.
      bindings.push(markSecretBindingRemoved(binding));
      retainedLegacy.push({
        configurationId: item.configurationId,
        revision: item.revision,
        provider: item.provider,
        binding: markSecretBindingRemoved(binding),
      });
      continue;
    }

    if (typeof entry === "string") {
      if (options.storage === "keyring") {
        const sourceKey = item.legacyKeyringName ?? getApiKeyName(item.provider);
        const destinationKey = getConfigurationSecretName(item.configurationId, item.revision);
        let value = entry;
        const source = readKeyringSecret(sourceKey);
        if (source.ok && source.value !== null) value = source.value;
        const copied = ensureKeyringCopy(sourceKey, destinationKey, value, keyringWrites);
        if (!copied.ok) {
          const rollback = rollbackConfigurationKeyringWrites(keyringWrites);
          return rollback.ok ? copied : rollback;
        }
        binding = createKeyringSecretBinding(item.configurationId, item.revision, destinationKey);
        if (sourceKey !== destinationKey) keyringDeletions.push(sourceKey);
      } else {
        const filePath =
          item.legacyFilePath ??
          options.filePathFor?.({
            configurationId: item.configurationId,
            revision: item.revision,
          });
        if (!filePath) {
          const rollback = rollbackConfigurationKeyringWrites(keyringWrites);
          return rollback.ok
            ? migrationFailure("A file path is required for a literal V1 secret migration")
            : rollback;
        }
        try {
          // Existing identical bytes make recovery idempotent.  All new files
          // are mode 0600 before they are exposed through the binding.
          let existing: string | null = null;
          try {
            existing = readFileSync(filePath, "utf8");
          } catch {}
          if (existing !== entry) {
            writeFileSync(filePath, entry, { encoding: "utf8", mode: 0o600 });
          }
          chmodSync(filePath, 0o600);
          if (readFileSync(filePath, "utf8") !== entry) {
            throw new Error("file read-back mismatch");
          }
        } catch {
          const rollback = rollbackConfigurationKeyringWrites(keyringWrites);
          return rollback.ok
            ? migrationFailure("Configuration secret file migration failed")
            : rollback;
        }
        binding = createFileSecretBinding(item.configurationId, item.revision, filePath);
      }
    }

    const migratedEntry = {
      configurationId: item.configurationId,
      revision: item.revision,
      provider: item.provider,
      binding,
    } satisfies V1SecretBindingMigration;
    bindings.push(binding);
    migrated.push(migratedEntry);
  }

  // Existing bindings are retained byte-for-byte by persistence.  Do not
  // append duplicate identities during recovery, and do not issue another
  // source-key deletion when the destination was already committed.
  const existing = new Set(
    (options.existingBindings ?? []).map(
      (binding) => `${binding.configurationId}\u0000${binding.revision}`,
    ),
  );
  const uniqueBindings = bindings.filter((binding) => {
    const key = `${binding.configurationId}\u0000${binding.revision}`;
    if (existing.has(key)) return false;
    existing.add(key);
    return true;
  });

  return ok({
    bindings: uniqueBindings,
    retainedLegacy,
    keyringDeletions: [...new Set(keyringDeletions)],
    migrated,
  });
}

/** Short name for callers that already have a V1 decoder result. */
export const migrateV1Secrets = migrateV1SecretsToBindings;

/** Recovery is the same idempotent operation with already persisted bindings. */
export const recoverV1SecretBindings = migrateV1SecretsToBindings;

/** Validate an externally supplied binding before handing it to persistence. */
export function validateConfigurationSecretBinding(
  binding: SecretBinding,
): Result<SecretBinding, SecretsStorageError> {
  const parsed = SecretBindingSchema.safeParse(binding);
  return parsed.success
    ? ok(parsed.data)
    : migrationFailure("Invalid configuration secret binding");
}
