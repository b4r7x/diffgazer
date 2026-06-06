import { createError, } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { SecretsStorage } from "@diffgazer/core/schemas/config";
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

/** Best-effort rollback of keyring writes on migration failure. */
function rollbackKeyringWrites(providerIds: readonly string[]): void {
  for (const providerId of providerIds) {
    const result = deleteKeyringSecret(getApiKeyName(providerId));
    if (!result.ok) {
      console.warn(
        `[diffgazer] Failed to rollback keyring write for '${providerId}': ${result.error.message}`,
      );
    }
  }
}

export interface MigrationResult {
  nextSecrets: SecretsState;
  removedFileSecrets: boolean;
  /**
   * When true, the caller must delete the secrets file AFTER the new config
   * state (secretsStorage changed) has been durably persisted. If a crash
   * occurs before deletion, the file still exists and the migration can be
   * safely re-run on next start.
   */
  shouldDeleteSecretsFile: boolean;
  /**
   * Provider IDs whose keyring entries must be deleted AFTER the file copy of
   * the secrets has been durably persisted. The caller is responsible for
   * invoking the keyring deletion only once `persistFileSecrets` has succeeded.
   * If a crash occurs between persist and keyring deletion the file already
   * holds the secret and the migration can safely be re-run.
   */
  keyringDeletions: readonly string[];
}

export function migrateSecretsStorage(
  configState: ConfigState,
  secretsState: SecretsState,
  fromStorage: SecretsStorage,
  toStorage: SecretsStorage,
): Result<MigrationResult, SecretsStorageError> {
  if (fromStorage === toStorage) {
    return ok({ nextSecrets: secretsState, removedFileSecrets: false, shouldDeleteSecretsFile: false, keyringDeletions: [] });
  }

  if (fromStorage === "file" && toStorage === "keyring") {
    if (!isKeyringAvailable()) {
      return err(
        createError<SecretsStorageErrorCode>("KEYRING_UNAVAILABLE", "System keyring is not available"),
      );
    }

    const envEntries: Record<string, { kind: "env"; varName: string }> = {};
    const writtenProviders: string[] = [];

    for (const [providerId, entry] of Object.entries(secretsState.providers)) {
      if (typeof entry !== "string" && entry.kind === "env") {
        envEntries[providerId] = entry;
        continue;
      }
      const apiKey = typeof entry === "string" ? entry : "";

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

      writtenProviders.push(providerId);
    }

    // File deletion is deferred to the caller -- the caller must persist the
    // updated config state (secretsStorage = "keyring") BEFORE deleting the
    // old secrets file. A crash between config persist and file deletion is
    // safe: the file still exists and the migration can be re-run.
    const shouldDelete = Object.keys(envEntries).length === 0;

    return ok({
      nextSecrets: { providers: envEntries },
      removedFileSecrets: false,
      shouldDeleteSecretsFile: shouldDelete,
      keyringDeletions: [],
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
      nextSecrets: { providers: nextSecrets },
      removedFileSecrets: false,
      shouldDeleteSecretsFile: false,
      keyringDeletions: keyringMigrated,
    });
  }

  return ok({ nextSecrets: secretsState, removedFileSecrets: false, shouldDeleteSecretsFile: false, keyringDeletions: [] });
}

/**
 * Deletes the keyring entries returned by a `keyring→file` migration. Must be
 * invoked AFTER the new file copy of the secrets has been durably persisted.
 */
export function finalizeKeyringDeletions(keyringDeletions: readonly string[]): void {
  for (const providerId of keyringDeletions) {
    const deleteResult = deleteKeyringSecret(getApiKeyName(providerId));
    if (!deleteResult.ok) {
      console.warn(
        `[diffgazer] Failed to delete keyring secret for '${providerId}': ${deleteResult.error.message}`,
      );
    }
  }
}
