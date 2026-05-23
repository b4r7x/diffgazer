import { type Result, ok, err } from "@diffgazer/core/result";
import { createError, getErrorMessage } from "@diffgazer/core/errors";
import type { SecretsStorage } from "@diffgazer/core/schemas/config";
import type {
  ConfigState,
  SecretsState,
  SecretsStorageError,
  SecretsStorageErrorCode,
} from "./types.js";
import {
  deleteKeyringSecret,
  isKeyringAvailable,
  readKeyringSecret,
  writeKeyringSecret,
} from "./keyring.js";
import { removeSecretsFile } from "./state.js";

export const getApiKeyName = (provider: string): string => `api_key_${provider}`;

export interface MigrationResult {
  nextSecrets: SecretsState;
  removedFileSecrets: boolean;
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
    return ok({ nextSecrets: secretsState, removedFileSecrets: false, keyringDeletions: [] });
  }

  if (fromStorage === "file" && toStorage === "keyring") {
    if (!isKeyringAvailable()) {
      return err(
        createError<SecretsStorageErrorCode>("KEYRING_UNAVAILABLE", "System keyring is not available"),
      );
    }

    const envEntries: Record<string, { kind: "env"; varName: string }> = {};
    for (const [providerId, entry] of Object.entries(secretsState.providers)) {
      // Env credential refs stay in the file -- they reference env vars, not keyring secrets
      if (typeof entry !== "string" && entry.kind === "env") {
        envEntries[providerId] = entry;
        continue;
      }
      const apiKey = typeof entry === "string" ? entry : "";
      const writeResult = writeKeyringSecret(getApiKeyName(providerId), apiKey);
      if (!writeResult.ok) return writeResult;
    }

    if (Object.keys(envEntries).length === 0) {
      try {
        removeSecretsFile();
      } catch (error) {
        console.warn(
          `[diffgazer] Failed to remove secrets file after migration: ${getErrorMessage(error)}`,
        );
      }
    }
    return ok({ nextSecrets: { providers: envEntries }, removedFileSecrets: Object.keys(envEntries).length === 0, keyringDeletions: [] });
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
      keyringDeletions: keyringMigrated,
    });
  }

  return ok({ nextSecrets: secretsState, removedFileSecrets: false, keyringDeletions: [] });
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
