import type { ProviderStatus, ProjectInfo, SettingsConfig, SecretsStorage, TrustConfig } from "@stargazer/schemas/config";
import type { AppError } from "@stargazer/core";

export interface ConfigState {
  settings: SettingsConfig;
  providers: ProviderStatus[];
}

export interface SecretsState {
  providers: Record<string, string>;
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
  | "SECRETS_MIGRATION_FAILED";

export type SecretsStorageError = AppError<SecretsStorageErrorCode>;
