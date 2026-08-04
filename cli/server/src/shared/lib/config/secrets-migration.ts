import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createError } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import {
  ConfigurationIdSchema,
  ConfigurationRevisionSchema,
  LEGACY_PROVIDER_IDS_V1,
  type SecretsStorage,
} from "@diffgazer/core/schemas/config";
import { log } from "../log.js";
import { deleteKeyringSecret, readKeyringSecret, writeKeyringSecret } from "./keyring.js";
import {
  createEnvironmentSecretBinding,
  createFileSecretBinding,
  createKeyringSecretBinding,
  createNoneSecretBinding,
  markSecretBindingRemoved,
  type SecretBinding,
} from "./secret-bindings.js";
import { getConfigurationSecretName } from "./secrets-store.js";
import type {
  SecretEntry,
  SecretsState,
  SecretsStorageError,
  SecretsStorageErrorCode,
} from "./types.js";

export const getApiKeyName = (provider: string): string => `api_key_${provider}`;

/**
 * Deletes the superseded keyring entries a migration reported, by key name.
 * Must be invoked only AFTER the new binding document is durably persisted, so
 * an interrupted migration leaves the source secret readable and re-runnable.
 */
export function finalizeKeyringDeletions(keyIds: readonly string[]): void {
  for (const keyId of keyIds) {
    const deleteResult = deleteKeyringSecret(keyId);
    if (!deleteResult.ok) {
      log("warn", "keyring_delete_failed", { keyId, error: deleteResult.error.message });
    }
  }
}

// ---------------------------------------------------------------------------
// V1 -> V2 configuration-bound secret migration
// ---------------------------------------------------------------------------

/** The only V1 records that may become an executable V2 binding. */
const MIGRATABLE_V1_PROVIDERS: ReadonlySet<string> = new Set(LEGACY_PROVIDER_IDS_V1);

/**
 * The V1 provider record does not contain a configuration identity.  T-030
 * supplies this explicit mapping during migration; accepting no implicit
 * provider->configuration fallback is what keeps credentials isolated.
 */
export interface LegacySecretConfiguration {
  readonly provider: string;
  readonly configurationId: string;
  readonly revision: number;
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
  /** Unknown legacy records remain named and untouched. */
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
): Result<SecretBinding, SecretsStorageError> => {
  const { configurationId, revision } = item;
  if (entry && typeof entry !== "string") {
    return ok(createEnvironmentSecretBinding(configurationId, revision, entry.varName));
  }

  if (options.storage === "keyring") {
    const keyId = item.legacyKeyringName ?? getApiKeyName(item.provider);
    return ok(createKeyringSecretBinding(configurationId, revision, keyId));
  }

  const filePath = item.legacyFilePath ?? options.filePathFor?.({ configurationId, revision });
  if (filePath) {
    return ok(createFileSecretBinding(configurationId, revision, filePath));
  }

  // A missing V1 value is represented explicitly as `none`.
  return ok(createNoneSecretBinding(configurationId, revision));
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
 * adapter is invoked.
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
    const bindingResult = bindingForLegacyEntry(item, entry, options);
    if (!bindingResult.ok) {
      const rollback = rollbackConfigurationKeyringWrites(keyringWrites);
      return rollback.ok ? bindingResult : rollback;
    }
    let binding = bindingResult.value;

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
            mkdirSync(dirname(filePath), { recursive: true });
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
