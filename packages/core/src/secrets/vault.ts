import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { join } from "node:path";
import { paths } from "../storage/paths.js";
import type { Result } from "../result.js";
import { ok, err } from "../result.js";

const SECRETS_FILE = "secrets.json";

export interface VaultError {
  code: string;
  message: string;
}

function vaultError(code: string, message: string): VaultError {
  return { code, message };
}

function getSecretsPath(): string {
  return join(paths.secretsDir(), SECRETS_FILE);
}

async function readSecrets(): Promise<Result<Record<string, string>, VaultError>> {
  const secretsPath = getSecretsPath();

  let content: string;
  try {
    content = await readFile(secretsPath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return ok({});
    }
    if ((error as NodeJS.ErrnoException).code === "EACCES") {
      return err(vaultError("PERMISSION_ERROR", "Permission denied reading secrets file"));
    }
    return err(vaultError("VAULT_READ_ERROR", "Failed to read secrets file"));
  }

  try {
    const parsed = JSON.parse(content) as Record<string, string>;
    return ok(parsed);
  } catch {
    return err(vaultError("PARSE_ERROR", "Secrets file contains invalid JSON"));
  }
}

async function writeSecrets(secrets: Record<string, string>): Promise<Result<void, VaultError>> {
  const secretsPath = getSecretsPath();
  const secretsDir = dirname(secretsPath);

  try {
    await mkdir(secretsDir, { recursive: true, mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EACCES") {
      return err(vaultError("PERMISSION_ERROR", "Permission denied creating secrets directory"));
    }
    return err(vaultError("VAULT_WRITE_ERROR", "Failed to create secrets directory"));
  }

  try {
    const content = JSON.stringify(secrets, null, 2) + "\n";
    await writeFile(secretsPath, content, { mode: 0o600 });
    return ok(undefined);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EACCES") {
      return err(vaultError("PERMISSION_ERROR", "Permission denied writing secrets file"));
    }
    return err(vaultError("VAULT_WRITE_ERROR", "Failed to write secrets file"));
  }
}

export async function getVaultSecret(secretKey: string): Promise<Result<string, VaultError>> {
  const secretsResult = await readSecrets();
  if (!secretsResult.ok) {
    return secretsResult;
  }

  const value = secretsResult.value[secretKey];
  if (value === undefined) {
    return err(vaultError("SECRET_NOT_FOUND", `Secret '${secretKey}' not found`));
  }

  return ok(value);
}

export async function setVaultSecret(secretKey: string, value: string): Promise<Result<void, VaultError>> {
  const secretsResult = await readSecrets();
  if (!secretsResult.ok) {
    return secretsResult;
  }

  const secrets = secretsResult.value;
  secrets[secretKey] = value;
  return writeSecrets(secrets);
}

export async function deleteVaultSecret(secretKey: string): Promise<Result<void, VaultError>> {
  const secretsResult = await readSecrets();
  if (!secretsResult.ok) {
    return secretsResult;
  }

  const secrets = secretsResult.value;
  delete secrets[secretKey];
  return writeSecrets(secrets);
}
