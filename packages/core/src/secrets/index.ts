import { isKeyringAvailable, getSecret, setSecret, deleteSecret } from "./keyring.js";
import { getVaultSecret, setVaultSecret, deleteVaultSecret } from "./vault.js";
import type { Result } from "../result.js";
import { ok, err } from "../result.js";
import { secretsError } from "./types.js";
import type { SecretsError } from "./types.js";

export type { SecretsError } from "./types.js";

type StorageBackend = "keyring" | "file";

let detectedBackend: StorageBackend | null = null;

async function getActiveBackend(forceRecheck = false): Promise<StorageBackend> {
  if (!forceRecheck && detectedBackend !== null) {
    return detectedBackend;
  }

  const keyringAvailable = await isKeyringAvailable();
  detectedBackend = keyringAvailable ? "keyring" : "file";

  return detectedBackend;
}

function getEnvApiKey(provider: string): string | undefined {
  const envKey = `${provider.toUpperCase().replace(/-/g, "_")}_API_KEY`;
  return process.env[envKey];
}

export async function getApiKey(provider: string): Promise<Result<string, SecretsError>> {
  const key = `api_key_${provider}`;

  // Priority 1: Try keyring if available
  const backend = await getActiveBackend();
  if (backend === "keyring") {
    const result = await getSecret(key);
    if (result.ok) return result;
  }

  // Priority 2: Try vault file
  const fileResult = await getVaultSecret(key);
  if (fileResult.ok) return fileResult;

  // Priority 3: Try environment variable
  const envValue = getEnvApiKey(provider);
  if (envValue) return ok(envValue);

  return err(secretsError("SECRET_NOT_FOUND", `API key for '${provider}' not found`));
}

export async function setApiKey(provider: string, apiKey: string): Promise<Result<void, SecretsError>> {
  const key = `api_key_${provider}`;
  const backend = await getActiveBackend();

  if (backend === "file") {
    return setVaultSecret(key, apiKey);
  }

  // Try keyring first
  const result = await setSecret(key, apiKey);
  if (result.ok) return result;

  // Keyring failed - re-check and fallback to vault if needed
  const newBackend = await getActiveBackend(true);
  return newBackend === "file" ? setVaultSecret(key, apiKey) : result;
}

export async function deleteApiKey(provider: string): Promise<Result<void, SecretsError>> {
  const key = `api_key_${provider}`;
  const backend = await getActiveBackend();

  if (backend === "keyring") {
    await deleteSecret(key);
  }
  await deleteVaultSecret(key);

  return ok(undefined);
}

export { isKeyringAvailable };
