import type { AppError } from "@diffgazer/core/errors";
import type {
  LegacyProviderConfigV1,
  LegacyProviderIdV1,
  LegacyRemovedProviderRecordV1,
  TrustConfig,
} from "@diffgazer/core/schemas/config";
import type { ConfigurationId, DecodedProviderConfigurationRecord } from "./provider-config.js";

/** A V1 entry narrowed to the ids this binary can still execute. */
export type RunnableV1Record = Omit<LegacyProviderConfigV1, "provider"> & {
  provider: ExecutableLegacyProviderId;
};

/** Legacy V1 executable provider ids used by the aggregate read bridge. */
export type ExecutableLegacyProviderId = "gemini" | "zai" | "openrouter" | "groq" | "cerebras";

/** Legacy V1 provider ids retained for decoder-only and migration records. */
export type AIProvider = LegacyProviderIdV1;

export const CONFIG_SCHEMA_VERSION_V2 = 2 as const;

/** The non-secret V2 document persisted by the server. */
export interface ConfigDocumentV2 {
  readonly schemaVersion: typeof CONFIG_SCHEMA_VERSION_V2;
  readonly settings: Record<string, unknown>;
  readonly selectedConfigurationId: ConfigurationId | null;
  readonly configurations: readonly DecodedProviderConfigurationRecord[];
  /** Present for an unmodified decode so a byte-identical round trip is possible. */
  readonly rawBytes?: Uint8Array;
  readonly rawSettingsBytes?: Uint8Array;
}

/** A V1 provider entry is only executable after an explicit migration step. */
export type V1ConfigurationRecord =
  | {
      readonly status: "migrate-v1";
      readonly record: RunnableV1Record;
      readonly rawBytes: Uint8Array;
    }
  | {
      readonly status: "removed";
      readonly record: LegacyRemovedProviderRecordV1;
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

export type ConfigurationActionErrorCode =
  | "CONFIGURATION_NOT_FOUND"
  | "CONFIGURATION_UNSUPPORTED"
  | "CONFIGURATION_CONFLICT"
  | "SECRET_BINDING_FAILED"
  | "INVALID_ACTION"
  | SecretsStorageErrorCode;

export type ConfigurationActionError = AppError<ConfigurationActionErrorCode>;
