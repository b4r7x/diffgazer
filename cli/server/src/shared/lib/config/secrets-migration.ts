import { createError } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { SecretsStorage } from "@diffgazer/core/schemas/config";
import { log } from "../log.js";
import {
  deleteKeyringSecret,
  isKeyringAvailable,
  readKeyringSecret,
  writeKeyringSecret,
} from "./keyring.js";
import type {
  ConfigState,
  SecretsState,
  SecretsStorageError,
  SecretsStorageErrorCode,
} from "./types.js";

export const getApiKeyName = (provider: string): string => `api_key_${provider}`;

export interface KeyringWriteRollback {
  providerId: string;
  previousValue: string | null;
}

/** Best-effort rollback of keyring writes on migration failure. */
export function rollbackKeyringWrites(entries: readonly KeyringWriteRollback[]): void {
  for (const entry of entries) {
    const result =
      entry.previousValue === null
        ? deleteKeyringSecret(getApiKeyName(entry.providerId))
        : writeKeyringSecret(getApiKeyName(entry.providerId), entry.previousValue);
    if (!result.ok) {
      log("warn", "keyring_rollback_write_failed", {
        providerId: entry.providerId,
        error: result.error.message,
      });
    }
  }
}

export interface MigrationResult {
  nextSecrets: SecretsState;
  removedFileSecrets: boolean;
  /**
   * When true, the caller must delete the secrets file AFTER the new config
   * state (secretsStorage changed) has been durably persisted. If a crash
   * occurs before deletion, the file still exists and `reconcileKeyringSecrets`
   * completes the migration on the next store creation.
   */
  shouldDeleteSecretsFile: boolean;
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
      removedFileSecrets: false,
      shouldDeleteSecretsFile: false,
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

    const envEntries: Record<string, { kind: "env"; varName: string }> = {};
    const writtenProviders: KeyringWriteRollback[] = [];

    for (const [providerId, entry] of Object.entries(secretsState.providers)) {
      if (typeof entry !== "string" && entry.kind === "env") {
        envEntries[providerId] = entry;
        continue;
      }
      const apiKey = typeof entry === "string" ? entry : "";
      const previousResult = readKeyringSecret(getApiKeyName(providerId));
      if (!previousResult.ok) return previousResult;

      // Phase 1: Write secret to keyring
      const writeResult = writeKeyringSecret(getApiKeyName(providerId), apiKey);
      if (!writeResult.ok) {
        rollbackKeyringWrites(writtenProviders);
        return writeResult;
      }

      // Phase 2: Verify the secret can be read back
      const verifyResult = readKeyringSecret(getApiKeyName(providerId));
      if (!verifyResult.ok || verifyResult.value !== apiKey) {
        rollbackKeyringWrites(writtenProviders);
        return err(
          createError<SecretsStorageErrorCode>(
            "SECRETS_MIGRATION_FAILED",
            `Keyring read-back verification failed for provider '${providerId}'`,
          ),
        );
      }

      writtenProviders.push({
        providerId,
        previousValue: previousResult.value,
      });
    }

    // File deletion is deferred to the caller -- the caller must persist the
    // updated config state (secretsStorage = "keyring") BEFORE deleting the
    // old secrets file. A crash between config persist and file deletion is
    // safe: the file still holds the literals and `reconcileKeyringSecrets`
    // completes the migration on the next store creation.
    const hasUnknownSecrets = Object.keys(secretsState.unknownSecrets ?? {}).length > 0;
    const shouldDelete = Object.keys(envEntries).length === 0 && !hasUnknownSecrets;

    return ok({
      nextSecrets: {
        providers: envEntries,
        ...(secretsState.unknownSecrets ? { unknownSecrets: secretsState.unknownSecrets } : {}),
      },
      removedFileSecrets: false,
      shouldDeleteSecretsFile: shouldDelete,
      keyringDeletions: [],
      keyringWrites: writtenProviders,
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
      // Skip providers that have env refs -- already handled above
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
      removedFileSecrets: false,
      shouldDeleteSecretsFile: false,
      keyringDeletions: keyringMigrated,
      keyringWrites: [],
    });
  }

  return ok({
    nextSecrets: secretsState,
    removedFileSecrets: false,
    shouldDeleteSecretsFile: false,
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
  const literalEntries = Object.entries(secretsState.providers).filter(
    ([, entry]) => typeof entry === "string",
  );
  if (literalEntries.length === 0) return ok(null);

  const written: KeyringWriteRollback[] = [];
  const nextProviders: SecretsState["providers"] = {};
  for (const [providerId, entry] of Object.entries(secretsState.providers)) {
    if (typeof entry !== "string") {
      nextProviders[providerId] = entry;
    }
  }

  const migrated: string[] = [];
  for (const [providerId, entry] of literalEntries) {
    const apiKey = entry as string;
    const previousResult = readKeyringSecret(getApiKeyName(providerId));
    if (!previousResult.ok) {
      rollbackKeyringWrites(written);
      return previousResult;
    }

    const writeResult = writeKeyringSecret(getApiKeyName(providerId), apiKey);
    if (!writeResult.ok) {
      rollbackKeyringWrites(written);
      return writeResult;
    }

    const verifyResult = readKeyringSecret(getApiKeyName(providerId));
    if (!verifyResult.ok || verifyResult.value !== apiKey) {
      rollbackKeyringWrites(written);
      return err(
        createError<SecretsStorageErrorCode>(
          "SECRETS_MIGRATION_FAILED",
          `Keyring read-back verification failed for provider '${providerId}'`,
        ),
      );
    }

    written.push({ providerId, previousValue: previousResult.value });
    migrated.push(providerId);
  }

  return ok({
    nextSecrets: {
      providers: nextProviders,
      ...(secretsState.unknownSecrets ? { unknownSecrets: secretsState.unknownSecrets } : {}),
    },
    migrated,
  });
}

/**
 * Completes an interrupted keyring→file migration at startup (F-449): when the
 * effective storage is "file" but the keyring still holds a provider's secret —
 * left there by a crash between writing secrets.json and deleting the keyring
 * entry — that entry is an orphan because the file is now the source of truth.
 * Returns the provider ids whose stale keyring entry should be finalized so the
 * caller can `finalizeKeyringDeletions` them. Only providers known to the config
 * are probed, so this never prompts the OS keyring for providers it never used.
 */
export function findOrphanedKeyringEntries(
  configState: ConfigState,
): Result<readonly string[], SecretsStorageError> {
  if (!isKeyringAvailable()) return ok([]);

  const orphans: string[] = [];
  for (const provider of configState.providers) {
    const result = readKeyringSecret(getApiKeyName(provider.provider));
    if (!result.ok) return result;
    if (result.value !== null) orphans.push(provider.provider);
  }
  return ok(orphans);
}
