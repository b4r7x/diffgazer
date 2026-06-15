import { createRequire } from "node:module";
import { createError, getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import { log } from "../log.js";
import type { SecretsStorageError, SecretsStorageErrorCode } from "./types.js";

type KeyringModule = typeof import("@napi-rs/keyring");

const KEYRING_APP_NAME = "diffgazer";
const KEYRING_TEST_KEY = "__diffgazer_keyring_test__";

const requireModule = createRequire(import.meta.url);
let cachedKeyring: KeyringModule | null | undefined;
let cachedKeyringAvailable: boolean | null = null;

const loadKeyring = (): KeyringModule | null => {
  if (cachedKeyring !== undefined) return cachedKeyring;

  try {
    cachedKeyring = requireModule("@napi-rs/keyring") as KeyringModule;
  } catch (error) {
    cachedKeyring = null;
    log("warn", "keyring_module_unavailable", { error: getErrorMessage(error) });
  }

  return cachedKeyring;
};

const checkKeyringAvailability = (keyring: KeyringModule): boolean => {
  try {
    const testValue = `test_${Date.now()}`;
    const entry = new keyring.Entry(KEYRING_APP_NAME, KEYRING_TEST_KEY);
    entry.setPassword(testValue);
    const readBack = entry.getPassword();
    try {
      entry.deletePassword();
    } catch (cleanupError) {
      log("warn", "keyring_test_key_cleanup_failed", { error: getErrorMessage(cleanupError) });
    }
    return readBack === testValue;
  } catch (error) {
    log("warn", "keyring_availability_check_failed", { error: getErrorMessage(error) });
    return false;
  }
};

export const isKeyringAvailable = (): boolean => {
  if (cachedKeyringAvailable === true) return true;

  const keyring = loadKeyring();
  if (!keyring) {
    return false;
  }

  const available = checkKeyringAvailability(keyring);
  if (available) cachedKeyringAvailable = true;
  return available;
};

const requireKeyring = (): Result<KeyringModule, SecretsStorageError> => {
  const keyring = loadKeyring();
  if (!keyring || !isKeyringAvailable()) {
    return err(
      createError<SecretsStorageErrorCode>(
        "KEYRING_UNAVAILABLE",
        "System keyring is not available",
      ),
    );
  }
  return ok(keyring);
};

export const readKeyringSecret = (key: string): Result<string | null, SecretsStorageError> => {
  const keyringResult = requireKeyring();
  if (!keyringResult.ok) return keyringResult;

  try {
    const entry = new keyringResult.value.Entry(KEYRING_APP_NAME, key);
    const value = entry.getPassword();
    return ok(value ?? null);
  } catch {
    return err(
      createError<SecretsStorageErrorCode>(
        "KEYRING_READ_FAILED",
        `Failed to read secret '${key}' from keyring`,
      ),
    );
  }
};

export const writeKeyringSecret = (
  key: string,
  value: string,
): Result<void, SecretsStorageError> => {
  const keyringResult = requireKeyring();
  if (!keyringResult.ok) return keyringResult;

  try {
    const entry = new keyringResult.value.Entry(KEYRING_APP_NAME, key);
    entry.setPassword(value);
    return ok(undefined);
  } catch {
    return err(
      createError<SecretsStorageErrorCode>(
        "KEYRING_WRITE_FAILED",
        `Failed to store secret '${key}' in keyring`,
      ),
    );
  }
};

export const deleteKeyringSecret = (key: string): Result<boolean, SecretsStorageError> => {
  const existingResult = readKeyringSecret(key);
  if (!existingResult.ok) return existingResult;
  if (existingResult.value === null) return ok(false);

  const keyringResult = requireKeyring();
  if (!keyringResult.ok) return keyringResult;

  try {
    const entry = new keyringResult.value.Entry(KEYRING_APP_NAME, key);
    entry.deletePassword();
    return ok(true);
  } catch {
    return err(
      createError<SecretsStorageErrorCode>(
        "KEYRING_DELETE_FAILED",
        `Failed to delete secret '${key}' from keyring`,
      ),
    );
  }
};
