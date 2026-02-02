import { isKeyringAvailable, getSecret, setSecret, deleteSecret } from "./keyring.js";
import { getVaultSecret, setVaultSecret, deleteVaultSecret } from "./vault.js";
import type { Result } from "@repo/core";
import { ok, err, createError } from "@repo/core";
import type { SecretsError, SecretsErrorCode } from "./types.js";

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

function getApiKeyName(provider: string): string {
  return `api_key_${provider}`;
}

function getEnvApiKey(provider: string): string | undefined {
  const envKey = `${provider.toUpperCase().replace(/-/g, "_")}_API_KEY`;
  return process.env[envKey];
}

export async function getApiKey(provider: string): Promise<Result<string, SecretsError>> {
  const key = getApiKeyName(provider);

  const backend = await getActiveBackend();
  if (backend === "keyring") {
    const result = await getSecret(key);
    if (result.ok) return result;
  }

  const fileResult = await getVaultSecret(key);
  if (fileResult.ok) return fileResult;

  const envValue = getEnvApiKey(provider);
  if (envValue) return ok(envValue);

  return err(createError<SecretsErrorCode>("SECRET_NOT_FOUND", `API key for '${provider}' not found`));
}

export async function setApiKey(provider: string, apiKey: string): Promise<Result<void, SecretsError>> {
  const key = getApiKeyName(provider);
  const backend = await getActiveBackend();

  if (backend === "file") {
    return setVaultSecret(key, apiKey);
  }

  const result = await setSecret(key, apiKey);
  if (result.ok) return result;

  const newBackend = await getActiveBackend(true);
  return newBackend === "file" ? setVaultSecret(key, apiKey) : result;
}

export async function deleteApiKey(provider: string): Promise<Result<void, SecretsError>> {
  const key = getApiKeyName(provider);
  const backend = await getActiveBackend();

  if (backend === "keyring") {
    const keyringResult = await deleteSecret(key);
    if (!keyringResult.ok) {
      return keyringResult;
    }
  }

  return deleteVaultSecret(key);
}

export { isKeyringAvailable };
