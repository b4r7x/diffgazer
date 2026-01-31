import type { Result } from "@repo/core";
import { ok, err, createError, getErrorMessage } from "@repo/core";
import { createLazyLoader } from "../lib/lazy-loader.js";
import { isNodeError } from "@repo/core";
import type { SecretsError, SecretsErrorCode } from "./types.js";

const APP_NAME = "stargazer";

type KeyringModule = typeof import("@napi-rs/keyring");

const getKeyringState = createLazyLoader<KeyringModule>(
  () => import("@napi-rs/keyring")
);

function createKeyringErrorFactory(
  defaultCode: SecretsErrorCode
): (error: unknown, message: string) => SecretsError {
  return (error, message) => {
    const code = isNodeError(error, "EACCES") ? "PERMISSION_ERROR" : defaultCode;
    return createError<SecretsErrorCode>(code, message, getErrorMessage(error));
  };
}

const readErrorFactory = createKeyringErrorFactory("READ_FAILED");
const writeErrorFactory = createKeyringErrorFactory("WRITE_FAILED");

async function withKeyring<T>(
  fn: (keyring: KeyringModule) => Result<T, SecretsError>
): Promise<Result<T, SecretsError>> {
  const { module: keyring, error } = await getKeyringState();
  if (!keyring) {
    return err(
      createError<SecretsErrorCode>(
        "KEYRING_UNAVAILABLE",
        "System keyring not available",
        error ?? undefined
      )
    );
  }
  return fn(keyring);
}

export async function isKeyringAvailable(): Promise<boolean> {
  const { module: keyring } = await getKeyringState();
  if (!keyring) return false;

  try {
    const testKey = "__stargazer_availability_test__";
    const testValue = "test_" + Date.now();
    const entry = new keyring.Entry(APP_NAME, testKey);

    entry.setPassword(testValue);
    const readBack = entry.getPassword();

    try {
      entry.deletePassword();
    } catch (cleanupError) {
      console.warn(`[keyring] Failed to clean up test key: ${getErrorMessage(cleanupError)}`);
    }

    return readBack === testValue;
  } catch (error) {
    console.warn(`[keyring] Availability check failed: ${getErrorMessage(error)}`);
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
      return err(readErrorFactory(error, `Failed to read secret '${key}'`));
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
      return err(writeErrorFactory(error, `Failed to store secret '${key}'`));
    }
  });
}

function isNotFoundError(error: unknown): boolean {
  if (isNodeError(error, "ENOENT")) {
    return true;
  }
  const msg = getErrorMessage(error).toLowerCase();
  return msg.includes("not found") || msg.includes("no such") || msg.includes("does not exist");
}

export async function deleteSecret(key: string): Promise<Result<void, SecretsError>> {
  return withKeyring((keyring) => {
    try {
      const entry = new keyring.Entry(APP_NAME, key);
      entry.deletePassword();
      return ok(undefined);
    } catch (error) {
      if (isNotFoundError(error)) {
        return ok(undefined);
      }
      return err(writeErrorFactory(error, `Failed to delete secret '${key}'`));
    }
  });
}
