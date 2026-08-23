import { type AppError, createError } from "@diffgazer/core/errors";
import type { LegacyProviderConfigV1, TrustConfig } from "@diffgazer/core/schemas/config";
import type { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { ConfigurationId, DecodedProviderConfigurationRecord } from "./provider-config.js";

export const CONFIG_SCHEMA_VERSION_V2 = 2 as const;
export const V1_MIGRATION_FAILED_MESSAGE = "Legacy configuration requires manual migration";

/** The non-secret V2 document persisted by the server. */
export interface ConfigDocumentV2 {
  readonly schemaVersion: typeof CONFIG_SCHEMA_VERSION_V2;
  readonly settings: Record<string, unknown>;
  readonly selectedConfigurationId: ConfigurationId | null;
  readonly configurations: readonly DecodedProviderConfigurationRecord[];
  /** Present for an unmodified decode so a byte-identical round trip is possible. */
  readonly rawBytes?: Uint8Array;
}

/** A V1 provider entry is only executable after an explicit migration step. */
export type V1ConfigurationRecord =
  | {
      readonly status: "migrate-v1";
      readonly record: LegacyProviderConfigV1;
      readonly rawBytes: Uint8Array;
    }
  | {
      readonly status: "unknown";
      readonly rawBytes: Uint8Array;
    };

export interface ConfigDocumentV1 {
  readonly schemaVersion: 1;
  readonly settings: Record<string, unknown>;
  readonly providers: readonly V1ConfigurationRecord[];
  readonly rawBytes: Uint8Array;
}

/** An env-var credential reference stored in the secrets file instead of a literal key. */
interface EnvCredentialRef {
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

// The codes the surfaces classify as credential-setup conditions are declared
// against core's `ErrorCode`, so renaming one there breaks this compile instead
// of silently dropping these failures onto the generic configuration gate.
export type SecretsStorageErrorCode =
  | typeof ErrorCode.KEYRING_UNAVAILABLE
  | typeof ErrorCode.KEYRING_READ_FAILED
  | "KEYRING_WRITE_FAILED"
  | "KEYRING_DELETE_FAILED"
  | "SECRETS_MIGRATION_FAILED"
  | "PERSIST_FAILED"
  | "ROLLBACK_FAILED"
  | typeof ErrorCode.STORAGE_NOT_CONFIGURED;

export type SecretsStorageError = AppError<SecretsStorageErrorCode>;

/** Failures the configuration action vocabulary owns, distinct from storage failures. */
export type ConfigurationActionOnlyErrorCode =
  | "CONFIGURATION_NOT_FOUND"
  | "CONFIGURATION_UNSUPPORTED"
  | "CONFIGURATION_CONFLICT"
  | typeof ErrorCode.SECRET_BINDING_FAILED
  | "INVALID_ACTION";

export type ConfigurationActionErrorCode =
  | ConfigurationActionOnlyErrorCode
  | SecretsStorageErrorCode;

export type ConfigurationActionError = AppError<ConfigurationActionErrorCode>;

export const configurationActionFailure = (
  code: ConfigurationActionErrorCode,
  message: string,
): ConfigurationActionError => createError<ConfigurationActionErrorCode>(code, message);
