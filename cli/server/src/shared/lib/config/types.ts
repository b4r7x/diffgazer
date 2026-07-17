import type { AppError } from "@diffgazer/core/errors";
import type { ProviderStatus, SettingsConfig, TrustConfig } from "@diffgazer/core/schemas/config";

export interface ConfigState {
  settings: SettingsConfig;
  providers: ProviderStatus[];
  /**
   * Provider entries from a newer binary that did not validate against the
   * current schema. Carried opaquely so they round-trip on persist instead of
   * being destroyed (F-445).
   */
  unknownProviders?: unknown[];
  /** Settings fields this binary does not recognize, preserved for round-trip (F-445). */
  unknownSettings?: Record<string, unknown>;
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
  /**
   * Secret entries this binary cannot resolve under current provider policy, such
   * as a newer reference type, a future provider, or a ref that fails its allowlist.
   * Carried opaquely so they round-trip instead of failing the whole file (F-445).
   */
  unknownSecrets?: Record<string, unknown>;
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
  | "ROLLBACK_FAILED"
  | "CONCURRENCY_CONFLICT"
  | "STORAGE_NOT_CONFIGURED";

export type SecretsStorageError = AppError<SecretsStorageErrorCode>;
