import { isKeyringAvailable, getSecret, setSecret, deleteSecret } from "./keyring.js";
import { getVaultSecret, setVaultSecret, deleteVaultSecret } from "./vault.js";
import type { Result } from "../result.js";
import { ok, err } from "../result.js";
import { secretsError } from "./types.js";
import type { SecretsError } from "./types.js";

export type { SecretsError } from "./types.js";

type StorageBackend = "keyring" | "file";

// Check once, cache forever (no TTL needed for local CLI tool)
let detectedBackend: StorageBackend | null = null;

async function getActiveBackend(forceRecheck = false): Promise<StorageBackend> {
  if (!forceRecheck && detectedBackend !== null) {
    return detectedBackend;
  }

  const keyringAvailable = await isKeyringAvailable();
  detectedBackend = keyringAvailable ? "keyring" : "file";

  console.log(`[secrets] Using ${detectedBackend} backend for credential storage`);
  return detectedBackend;
}

function getEnvKeyName(provider: string): string {
  const providerUpper = provider.toUpperCase().replace(/-/g, "_");
  return `${providerUpper}_API_KEY`;
}

function getEnvApiKey(provider: string): string | undefined {
  return process.env[getEnvKeyName(provider)];
}

export async function getApiKey(provider: string): Promise<Result<string, SecretsError>> {
  const key = `api_key_${provider}`;
  const backend = await getActiveBackend();

  // Priority 1: Try OS keyring
  if (backend === "keyring") {
    const result = await getSecret(key);
    if (result.ok) {
      return result;
    }
  }

  // Priority 2: Try file storage
  const fileResult = await getVaultSecret(key);
  if (fileResult.ok) {
    return fileResult;
  }

  // Priority 3: Environment variable fallback
  const envValue = getEnvApiKey(provider);
  if (envValue) {
    return ok(envValue);
  }

  return err(secretsError("SECRET_NOT_FOUND", `API key for '${provider}' not found`));
}

export async function setApiKey(provider: string, apiKey: string): Promise<Result<void, SecretsError>> {
  const key = `api_key_${provider}`;
  const backend = await getActiveBackend();

  if (backend === "keyring") {
    const result = await setSecret(key, apiKey);
    if (result.ok) {
      return result;
    }
    // Keyring write failed - force recheck and potentially switch to file
    const newBackend = await getActiveBackend(true);
    if (newBackend === "file") {
      return setVaultSecret(key, apiKey);
    }
    return result;
  }

  return setVaultSecret(key, apiKey);
}

export async function deleteApiKey(provider: string): Promise<Result<void, SecretsError>> {
  const key = `api_key_${provider}`;
  const backend = await getActiveBackend();

  // Try to delete from both backends to ensure cleanup
  if (backend === "keyring") {
    await deleteSecret(key);
  }
  await deleteVaultSecret(key);

  return ok(undefined);
}

export function clearKeyringCache(): void {
  detectedBackend = null;
}

export { isKeyringAvailable };
