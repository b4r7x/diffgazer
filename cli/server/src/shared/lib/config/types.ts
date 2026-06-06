import type { AppError } from "@diffgazer/core/errors";
import type { ProviderStatus, SettingsConfig, TrustConfig } from "@diffgazer/core/schemas/config";

export interface ConfigState {
  settings: SettingsConfig;
  providers: ProviderStatus[];
}

/** An env-var credential reference stored in the secrets file instead of a literal key. */
export interface EnvCredentialRef {
  kind: "env";
  varName: string;
}

/** A secret entry is either a literal API key string or an env-var reference. */
export type SecretEntry = string | EnvCredentialRef;

export interface SecretsState {
  providers: Record<string, SecretEntry>;
}

export interface TrustState {
  projects: Record<string, TrustConfig>;
}

export interface ProjectFile {
  projectId: string;
  repoRoot: string;
  createdAt: string;
}

export type SecretsStorageErrorCode =
  | "KEYRING_UNAVAILABLE"
  | "KEYRING_READ_FAILED"
  | "KEYRING_WRITE_FAILED"
  | "KEYRING_DELETE_FAILED"
  | "SECRET_NOT_FOUND"
  | "SECRETS_MIGRATION_FAILED"
  | "PERSIST_FAILED"
  | "CONCURRENCY_CONFLICT"
  | "STORAGE_NOT_CONFIGURED";

export type SecretsStorageError = AppError<SecretsStorageErrorCode>;
