import { readFileSync } from "node:fs";
import { getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import { log } from "../../log.js";
import { isNodeError } from "../../node-error.js";
import { getGlobalConfigPath, getGlobalSecretsPath } from "../../paths.js";
import { decodeConfigFile, isV1ConfigMigrationFailure } from "../persistence/config.js";
import {
  decodeSecretsV1,
  decodeSecretsV2,
  SECRETS_SCHEMA_VERSION_V2,
  type SecretsDocumentV2,
} from "../persistence/secrets.js";
import {
  type DocumentRecoveryRecord,
  readDocumentRecovery,
  restoreDocumentRecovery,
} from "../persistence/secrets-recovery.js";
import type { ConfigurationBudgetLimits } from "../provider-config.js";
import type {
  ConfigDocumentV1,
  ConfigDocumentV2,
  ConfigurationActionError,
  SecretsState,
  SecretsStorageError,
} from "../types.js";
import { CONFIG_SCHEMA_VERSION_V2 } from "../types.js";
import { preflightV1Documents } from "../v1-upgrade.js";

const fatalTextDecoder = new TextDecoder("utf-8", { fatal: true });

export const EMPTY_CONFIG_DOCUMENT: ConfigDocumentV2 = {
  schemaVersion: CONFIG_SCHEMA_VERSION_V2,
  settings: {},
  selectedConfigurationId: null,
  configurations: [],
};

export const EMPTY_SECRETS_DOCUMENT: SecretsDocumentV2 = {
  schemaVersion: SECRETS_SCHEMA_VERSION_V2,
  bindings: [],
};

export type CapturedDocuments =
  | Readonly<{
      kind: "v1";
      config: ConfigDocumentV1;
      secrets: SecretsState;
      configBytes: Uint8Array;
      secretsBytes: Uint8Array | null;
    }>
  | Readonly<{
      kind: "v2";
      config: ConfigDocumentV2;
      secrets: SecretsDocumentV2;
      configBytes: Uint8Array | null;
      secretsBytes: Uint8Array | null;
    }>;

/**
 * The store's own latch for a v1 document this build refuses to migrate. Capture
 * reads it to keep a refusal sticky and arms it when it meets a new one; the
 * store owns where that verdict lives.
 */
export type V1MigrationLatch = Readonly<{
  latched: () => SecretsStorageError | null;
  latch: () => SecretsStorageError;
}>;

export interface DocumentCapture {
  /** Decodes the documents on disk, or `null` when this build cannot read them. */
  inspectDominantV1State(): Result<CapturedDocuments | null, ConfigurationActionError>;
  inspectRecoveryRecordV1State(record: DocumentRecoveryRecord): Result<void, SecretsStorageError>;
  /** Disk plus any pending journal: a v1 document in either one blocks the store. */
  inspectDominantStoreState(): Result<CapturedDocuments | null, ConfigurationActionError>;
  restoreRecovery(record: DocumentRecoveryRecord): Promise<SecretsStorageError | null>;
}

const loadFileBytes = (filePath: string): Uint8Array | null => {
  try {
    return new Uint8Array(readFileSync(filePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

const isDefiniteV1MigrationFailure = (cause: unknown, configBytes: Uint8Array | null): boolean => {
  if (!isV1ConfigMigrationFailure(cause) || configBytes === null) return false;
  try {
    JSON.parse(fatalTextDecoder.decode(configBytes));
    return true;
  } catch {
    return false;
  }
};

const decodeRecoverySnapshot = (
  snapshot: DocumentRecoveryRecord["previousConfig"],
): Uint8Array | null =>
  snapshot.base64 === null ? null : new Uint8Array(Buffer.from(snapshot.base64, "base64"));

export function createDocumentCapture(
  deps: Readonly<{ budget: ConfigurationBudgetLimits; latch: V1MigrationLatch }>,
): DocumentCapture {
  const { budget, latch } = deps;

  const inspectDominantV1State = (): Result<CapturedDocuments | null, ConfigurationActionError> => {
    const latchedFailure = latch.latched();
    let configBytes: Uint8Array | null;
    try {
      configBytes = loadFileBytes(getGlobalConfigPath());
    } catch (cause) {
      // An unreadable file (EACCES, EISDIR, I/O) reaches the user as
      // CONFIGURATION_UNSUPPORTED, so the errno has to survive somewhere.
      log("warn", "config_document_read_failed", {
        code: isNodeError(cause) ? cause.code : undefined,
        error: getErrorMessage(cause),
      });
      return latchedFailure ? err(latchedFailure) : ok(null);
    }

    if (configBytes === null) {
      if (latchedFailure) return err(latchedFailure);
      try {
        const secretsBytes = loadFileBytes(getGlobalSecretsPath());
        return ok({
          kind: "v2",
          config: EMPTY_CONFIG_DOCUMENT,
          secrets: secretsBytes === null ? EMPTY_SECRETS_DOCUMENT : decodeSecretsV2(secretsBytes),
          configBytes,
          secretsBytes,
        });
      } catch {
        return ok(null);
      }
    }

    let decoded: ConfigDocumentV1 | ConfigDocumentV2;
    try {
      decoded = decodeConfigFile(configBytes);
    } catch (cause) {
      if (isDefiniteV1MigrationFailure(cause, configBytes)) {
        return err(latch.latch());
      }
      return latchedFailure ? err(latchedFailure) : ok(null);
    }

    if (decoded.schemaVersion === CONFIG_SCHEMA_VERSION_V2) {
      try {
        const secretsBytes = loadFileBytes(getGlobalSecretsPath());
        const captured = {
          kind: "v2",
          config: decoded,
          secrets: secretsBytes === null ? EMPTY_SECRETS_DOCUMENT : decodeSecretsV2(secretsBytes),
          configBytes,
          secretsBytes,
        } satisfies CapturedDocuments;
        return ok(captured);
      } catch {
        return latchedFailure ? err(latchedFailure) : ok(null);
      }
    }

    try {
      const secretsBytes = loadFileBytes(getGlobalSecretsPath());
      const secrets = secretsBytes === null ? { providers: {} } : decodeSecretsV1(secretsBytes);
      const preflight = preflightV1Documents(decoded, secrets, { budget });
      if (!preflight.ok || latchedFailure) return err(latch.latch());
      return ok({ kind: "v1", config: decoded, secrets, configBytes, secretsBytes });
    } catch {
      return err(latch.latch());
    }
  };

  const inspectRecoveryRecordV1State = (
    record: DocumentRecoveryRecord,
  ): Result<void, SecretsStorageError> => {
    const configBytes = decodeRecoverySnapshot(record.previousConfig);
    const latchedFailure = latch.latched();
    if (configBytes === null) return latchedFailure ? err(latchedFailure) : ok(undefined);

    let decoded: ConfigDocumentV1 | ConfigDocumentV2;
    try {
      decoded = decodeConfigFile(configBytes);
    } catch (cause) {
      if (isDefiniteV1MigrationFailure(cause, configBytes)) {
        return err(latch.latch());
      }
      return latchedFailure ? err(latchedFailure) : ok(undefined);
    }
    if (decoded.schemaVersion === CONFIG_SCHEMA_VERSION_V2) {
      try {
        const secretsBytes = decodeRecoverySnapshot(record.previousSecrets);
        if (secretsBytes !== null) decodeSecretsV2(secretsBytes);
        return ok(undefined);
      } catch {
        return latchedFailure ? err(latchedFailure) : ok(undefined);
      }
    }
    if (latchedFailure) return err(latchedFailure);

    try {
      const secretsBytes = decodeRecoverySnapshot(record.previousSecrets);
      const secrets = secretsBytes === null ? { providers: {} } : decodeSecretsV1(secretsBytes);
      const preflight = preflightV1Documents(decoded, secrets, { budget });
      return preflight.ok ? ok(undefined) : err(latch.latch());
    } catch {
      return err(latch.latch());
    }
  };

  return {
    inspectDominantV1State,
    inspectRecoveryRecordV1State,
    inspectDominantStoreState: () => {
      const current = inspectDominantV1State();
      if (!current.ok) return current;
      const recovery = readDocumentRecovery();
      if (recovery.kind !== "valid") return current;
      const recoveryState = inspectRecoveryRecordV1State(recovery.record);
      return recoveryState.ok ? current : recoveryState;
    },
    restoreRecovery: async (record) => {
      const blockedRecovery = inspectRecoveryRecordV1State(record);
      return blockedRecovery.ok ? restoreDocumentRecovery(record) : blockedRecovery.error;
    },
  };
}
