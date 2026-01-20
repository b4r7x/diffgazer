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

export async function isKeyringAvailable(): Promise<boolean> {
  const keyring = await getKeyring();
  if (!keyring) {
    return false;
  }

  try {
    const testKey = "__stargazer_availability_test__";
    const testValue = "test_" + Date.now();
    const entry = new keyring.Entry(SERVICE_NAME, testKey);

    // Test actual write capability
    entry.setPassword(testValue);

    // Verify we can read it back
    const readBack = entry.getPassword();
    const matches = readBack === testValue;

    // Clean up
    try {
      entry.deletePassword();
    } catch {
      // Ignore delete errors
    }

    return matches;
  } catch {
    return false;
  }
}

export async function getSecret(key: string): Promise<Result<string, SecretsError>> {
  const keyring = await getKeyring();
  if (!keyring) {
    return err(secretsError("KEYRING_UNAVAILABLE", "System keyring not available"));
  }

  try {
    const entry = new keyring.Entry(SERVICE_NAME, key);
    const password = entry.getPassword();
    if (password === null) {
      return err(secretsError("SECRET_NOT_FOUND", `Secret '${key}' not found`));
    }
    return ok(password);
  } catch {
    return err(secretsError("SECRET_NOT_FOUND", `Secret '${key}' not found`));
  }
}

export async function setSecret(key: string, value: string): Promise<Result<void, SecretsError>> {
  const keyring = await getKeyring();
  if (!keyring) {
    return err(secretsError("KEYRING_UNAVAILABLE", "System keyring not available"));
  }

  try {
    const entry = new keyring.Entry(SERVICE_NAME, key);
    entry.setPassword(value);
    return ok(undefined);
  } catch {
    return err(secretsError("WRITE_FAILED", "Failed to store secret"));
  }
}

export async function deleteSecret(key: string): Promise<Result<void, SecretsError>> {
  const keyring = await getKeyring();
  if (!keyring) {
    return err(secretsError("KEYRING_UNAVAILABLE", "System keyring not available"));
  }

  try {
    const entry = new keyring.Entry(SERVICE_NAME, key);
    entry.deletePassword();
    return ok(undefined);
  } catch {
    return ok(undefined);
  }
}
