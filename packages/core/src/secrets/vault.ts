import { dirname } from "node:path";
import { paths } from "../storage/paths.js";
import type { Result } from "../result.js";
import { ok, err } from "../result.js";
import type { SecretsError, SecretsErrorCode } from "./types.js";
import { createError } from "../errors.js";
import { safeParseJson } from "../json.js";
import {
  safeReadFile,
  ensureDirectory,
  atomicWriteFile,
  createMappedErrorFactory,
} from "../fs/operations.js";

const readErrorFactory = createMappedErrorFactory<SecretsErrorCode>(
  {
    NOT_FOUND: "VAULT_READ_ERROR",
    PERMISSION_DENIED: "PERMISSION_ERROR",
    READ_ERROR: "VAULT_READ_ERROR",
    WRITE_ERROR: "VAULT_READ_ERROR",
  },
  createError
);

const writeErrorFactory = createMappedErrorFactory<SecretsErrorCode>(
  {
    NOT_FOUND: "VAULT_WRITE_ERROR",
    PERMISSION_DENIED: "PERMISSION_ERROR",
    READ_ERROR: "VAULT_WRITE_ERROR",
    WRITE_ERROR: "VAULT_WRITE_ERROR",
  },
  createError
);

async function readSecrets(): Promise<Result<Record<string, string>, SecretsError>> {
  const secretsPath = paths.secretsFile;

  const readResult = await safeReadFile(secretsPath, "secrets file", readErrorFactory);
  if (!readResult.ok) {
    if (readResult.error.code === "VAULT_READ_ERROR" && readResult.error.message.includes("not found")) {
      return ok({});
    }
    return readResult;
  }

  const parseResult = safeParseJson(readResult.value, (message, details) =>
    createError<SecretsErrorCode>("PARSE_ERROR", `Secrets file: ${message}`, details)
  );
  if (!parseResult.ok) {
    return parseResult;
  }
  return ok(parseResult.value as Record<string, string>);
}

async function writeSecrets(secrets: Record<string, string>): Promise<Result<void, SecretsError>> {
  const secretsPath = paths.secretsFile;

  const dirResult = await ensureDirectory(dirname(secretsPath), "secrets", writeErrorFactory, { mode: 0o700 });
  if (!dirResult.ok) {
    return dirResult;
  }

  const content = JSON.stringify(secrets, null, 2) + "\n";
  return atomicWriteFile(secretsPath, content, "secrets file", writeErrorFactory, { mode: 0o600 });
}

export async function getVaultSecret(secretKey: string): Promise<Result<string, SecretsError>> {
  const secretsResult = await readSecrets();
  if (!secretsResult.ok) {
    return secretsResult;
  }

  const value = secretsResult.value[secretKey];
  if (value === undefined) {
    return err(createError<SecretsErrorCode>("SECRET_NOT_FOUND", `Secret '${secretKey}' not found`));
  }

  return ok(value);
}

export async function setVaultSecret(secretKey: string, value: string): Promise<Result<void, SecretsError>> {
  const secretsResult = await readSecrets();
  if (!secretsResult.ok) {
    return secretsResult;
  }

  const secrets = secretsResult.value;
  secrets[secretKey] = value;
  return writeSecrets(secrets);
}

export async function deleteVaultSecret(secretKey: string): Promise<Result<void, SecretsError>> {
  const secretsResult = await readSecrets();
  if (!secretsResult.ok) {
    return secretsResult;
  }

  const secrets = secretsResult.value;
  if (!(secretKey in secrets)) {
    return ok(undefined);
  }

  delete secrets[secretKey];
  return writeSecrets(secrets);
}
