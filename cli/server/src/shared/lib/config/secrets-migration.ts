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

    const envEntries: Record<string, { kind: "env"; varName: string }> = {};
    const writtenProviders: KeyringWriteRollback[] = [];

    for (const [providerId, entry] of Object.entries(secretsState.providers)) {
      if (typeof entry !== "string" && entry.kind === "env") {
        envEntries[providerId] = entry;
        continue;
      }
      const apiKey = typeof entry === "string" ? entry : "";
      const previousResult = readKeyringSecret(getApiKeyName(providerId));
      if (!previousResult.ok) {
        const rollbackResult = rollbackKeyringWrites(writtenProviders);
        return rollbackResult.ok ? previousResult : rollbackResult;
      }

      writtenProviders.push({
        providerId,
        previousValue: previousResult.value,
      });

      const writeResult = writeKeyringSecret(getApiKeyName(providerId), apiKey);
      if (!writeResult.ok) {
        const rollbackResult = rollbackKeyringWrites(writtenProviders);
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
        const rollbackResult = rollbackKeyringWrites(writtenProviders);
        return rollbackResult.ok ? failure : rollbackResult;
      }
    }

    return ok({
      nextSecrets: {
        providers: envEntries,
        ...(secretsState.unknownSecrets ? { unknownSecrets: secretsState.unknownSecrets } : {}),
      },
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
