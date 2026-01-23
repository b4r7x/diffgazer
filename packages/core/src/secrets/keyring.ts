import type { Result } from "../result.js";
import { ok, err } from "../result.js";
import { APP_NAME } from "../storage/paths.js";
import { createError, getErrorMessage } from "../errors.js";
import type { SecretsError, SecretsErrorCode } from "./types.js";

/** Store the import error for diagnostic purposes */
let keyringLoadError: string | null = null;

let keyringModule: typeof import("@napi-rs/keyring") | null = null;
let loadAttempted = false;

async function getKeyring(): Promise<typeof import("@napi-rs/keyring") | null> {
  if (loadAttempted) {
    return keyringModule;
  }
  loadAttempted = true;

  try {
    keyringModule = await import("@napi-rs/keyring");
    return keyringModule;
  } catch (error) {
    keyringLoadError = getErrorMessage(error);
    return null;
  }
}

async function withKeyring<T>(
  fn: (keyring: typeof import("@napi-rs/keyring")) => Result<T, SecretsError>
): Promise<Result<T, SecretsError>> {
  const keyring = await getKeyring();
  if (!keyring) {
    return err(
      createError<SecretsErrorCode>(
        "KEYRING_UNAVAILABLE",
        "System keyring not available",
        keyringLoadError ?? undefined
      )
    );
  }
  return fn(keyring);
}

/**
 * Check if the system keyring is available and functional.
 * Returns detailed information about availability status.
 */
export async function isKeyringAvailable(): Promise<boolean> {
  const keyring = await getKeyring();
  if (!keyring) {
    // Module failed to load - error already captured in keyringLoadError
    return false;
  }

  try {
    const testKey = "__stargazer_availability_test__";
    const testValue = "test_" + Date.now();
    const entry = new keyring.Entry(APP_NAME, testKey);

    entry.setPassword(testValue);
    const readBack = entry.getPassword();

    try {
      entry.deletePassword();
    } catch (cleanupError) {
      // Log cleanup failure but don't fail the availability check
      // The test key will be orphaned but won't affect functionality
      console.warn(
        `[keyring] Failed to clean up test key: ${getErrorMessage(cleanupError)}`
      );
    }

    return readBack === testValue;
  } catch (error) {
    // Keyring operations failed - this indicates the keyring is not functional
    // Common causes: no keyring daemon running, permission denied, locked keyring
    console.warn(
      `[keyring] Availability check failed: ${getErrorMessage(error)}`
    );
    return false;
  }
}

export async function getSecret(key: string): Promise<Result<string, SecretsError>> {
  return withKeyring((keyring) => {
    try {
      const entry = new keyring.Entry(APP_NAME, key);
      const password = entry.getPassword();
      if (password === null) {
        return err(createError<SecretsErrorCode>("SECRET_NOT_FOUND", `Secret '${key}' not found`));
      }
      return ok(password);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      // Check for permission-related errors to provide more specific feedback
      if (errorMessage.toLowerCase().includes("permission") || errorMessage.toLowerCase().includes("access denied")) {
        return err(
          createError<SecretsErrorCode>(
            "PERMISSION_ERROR",
            `Permission denied reading secret '${key}'`,
            errorMessage
          )
        );
      }
      return err(
        createError<SecretsErrorCode>(
          "READ_FAILED",
          `Failed to read secret '${key}'`,
          errorMessage
        )
      );
    }
  });
}

export async function setSecret(key: string, value: string): Promise<Result<void, SecretsError>> {
  return withKeyring((keyring) => {
    try {
      const entry = new keyring.Entry(APP_NAME, key);
      entry.setPassword(value);
      return ok(undefined);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      // Check for permission-related errors to provide more specific feedback
      if (errorMessage.toLowerCase().includes("permission") || errorMessage.toLowerCase().includes("access denied")) {
        return err(
          createError<SecretsErrorCode>(
            "PERMISSION_ERROR",
            `Permission denied storing secret '${key}'`,
            errorMessage
          )
        );
      }
      return err(
        createError<SecretsErrorCode>(
          "WRITE_FAILED",
          `Failed to store secret '${key}'`,
          errorMessage
        )
      );
    }
  });
}

export async function deleteSecret(key: string): Promise<Result<void, SecretsError>> {
  return withKeyring((keyring) => {
    try {
      const entry = new keyring.Entry(APP_NAME, key);
      entry.deletePassword();
      return ok(undefined);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      // Check if this is a "not found" error - treat as success (idempotent delete)
      // Common patterns: "No such secret", "not found", "does not exist"
      const isNotFoundError =
        errorMessage.toLowerCase().includes("not found") ||
        errorMessage.toLowerCase().includes("no such") ||
        errorMessage.toLowerCase().includes("does not exist");

      if (isNotFoundError) {
        // Idempotent: treat delete of non-existent secret as success
        return ok(undefined);
      }

      // Check for permission-related errors
      if (errorMessage.toLowerCase().includes("permission") || errorMessage.toLowerCase().includes("access denied")) {
        return err(
          createError<SecretsErrorCode>(
            "PERMISSION_ERROR",
            `Permission denied deleting secret '${key}'`,
            errorMessage
          )
        );
      }

      // Propagate other errors - they indicate real problems
      return err(
        createError<SecretsErrorCode>(
          "WRITE_FAILED",
          `Failed to delete secret '${key}'`,
          errorMessage
        )
      );
    }
  });
}
