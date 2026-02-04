import { createRequire } from "node:module";
import { SecretsStorageError } from "./errors.js";

type KeyringModule = typeof import("@napi-rs/keyring");

const KEYRING_APP_NAME = "stargazer";
const KEYRING_TEST_KEY = "__stargazer_keyring_test__";

const requireModule = createRequire(import.meta.url);
let cachedKeyring: KeyringModule | null | undefined;
let cachedKeyringAvailable: boolean | null = null;

const loadKeyring = (): KeyringModule | null => {
  if (cachedKeyring !== undefined) return cachedKeyring;

  try {
    cachedKeyring = requireModule("@napi-rs/keyring") as KeyringModule;
  } catch (error) {
    cachedKeyring = null;
    console.warn(
      `[stargazer] Keyring module unavailable: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
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
      console.warn(
        `[stargazer] Failed to clean up keyring test key: ${
          cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
        }`
      );
    }
    return readBack === testValue;
  } catch (error) {
    console.warn(
      `[stargazer] Keyring availability check failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return false;
  }
};

export const isKeyringAvailable = (): boolean => {
  if (cachedKeyringAvailable !== null) return cachedKeyringAvailable;

  const keyring = loadKeyring();
  if (!keyring) {
    cachedKeyringAvailable = false;
    return false;
  }

  cachedKeyringAvailable = checkKeyringAvailability(keyring);
  return cachedKeyringAvailable;
};

const requireKeyring = (): KeyringModule => {
  const keyring = loadKeyring();
  if (!keyring || !isKeyringAvailable()) {
    throw new SecretsStorageError(
      "KEYRING_UNAVAILABLE",
      "System keyring is not available"
    );
  }
  return keyring;
};

export const readKeyringSecret = (key: string): string | null => {
  const keyring = requireKeyring();
  try {
    const entry = new keyring.Entry(KEYRING_APP_NAME, key);
    const value = entry.getPassword();
    return value ?? null;
  } catch {
    throw new SecretsStorageError(
      "KEYRING_READ_FAILED",
      `Failed to read secret '${key}' from keyring`
    );
  }
};

export const writeKeyringSecret = (key: string, value: string): void => {
  const keyring = requireKeyring();
  try {
    const entry = new keyring.Entry(KEYRING_APP_NAME, key);
    entry.setPassword(value);
  } catch {
    throw new SecretsStorageError(
      "KEYRING_WRITE_FAILED",
      `Failed to store secret '${key}' in keyring`
    );
  }
};

export const deleteKeyringSecret = (key: string): boolean => {
  const existing = readKeyringSecret(key);
  if (existing === null) return false;

  const keyring = requireKeyring();
  try {
    const entry = new keyring.Entry(KEYRING_APP_NAME, key);
    entry.deletePassword();
    return true;
  } catch {
    throw new SecretsStorageError(
      "KEYRING_DELETE_FAILED",
      `Failed to delete secret '${key}' from keyring`
    );
  }
};
