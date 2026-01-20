import type { Result } from "../result.js";
import { ok, err } from "../result.js";
import { secretsError } from "./types.js";
import type { SecretsError } from "./types.js";

const SERVICE_NAME = "stargazer";

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
  } catch {
    return null;
  }
}

async function withKeyring<T>(
  fn: (keyring: typeof import("@napi-rs/keyring")) => Result<T, SecretsError>
): Promise<Result<T, SecretsError>> {
  const keyring = await getKeyring();
  if (!keyring) {
    return err(secretsError("KEYRING_UNAVAILABLE", "System keyring not available"));
  }
  return fn(keyring);
}

export async function isKeyringAvailable(): Promise<boolean> {
  const keyring = await getKeyring();
  if (!keyring) {
    return false;
  }

  try {
    const testKey = "__stargazer_availability_test__";
    const testValue = "test_" + Date.now();
    const entry = new keyring.Entry(SERVICE_NAME, testKey);

    entry.setPassword(testValue);
    const readBack = entry.getPassword();

    try {
      entry.deletePassword();
    } catch {}

    return readBack === testValue;
  } catch {
    return false;
  }
}

export async function getSecret(key: string): Promise<Result<string, SecretsError>> {
  return withKeyring((keyring) => {
    try {
      const entry = new keyring.Entry(SERVICE_NAME, key);
      const password = entry.getPassword();
      if (password === null) {
        return err(secretsError("SECRET_NOT_FOUND", `Secret '${key}' not found`));
      }
      return ok(password);
    } catch {
      return err(secretsError("READ_FAILED", `Failed to read secret '${key}'`));
    }
  });
}

export async function setSecret(key: string, value: string): Promise<Result<void, SecretsError>> {
  return withKeyring((keyring) => {
    try {
      const entry = new keyring.Entry(SERVICE_NAME, key);
      entry.setPassword(value);
      return ok(undefined);
    } catch {
      return err(secretsError("WRITE_FAILED", "Failed to store secret"));
    }
  });
}

export async function deleteSecret(key: string): Promise<Result<void, SecretsError>> {
  return withKeyring((keyring) => {
    try {
      const entry = new keyring.Entry(SERVICE_NAME, key);
      entry.deletePassword();
      return ok(undefined);
    } catch {
      // Idempotent: treat delete of non-existent secret as success
      return ok(undefined);
    }
  });
}
