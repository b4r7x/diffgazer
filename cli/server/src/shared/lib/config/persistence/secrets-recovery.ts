import { createError, getErrorMessage } from "@diffgazer/core/errors";
import { z } from "zod";
import {
  atomicWriteFile,
  readJsonFileSyncSafe,
  removeFileSync,
  writeJsonFileSync,
} from "../../fs.js";
import { log } from "../../log.js";
import { getGlobalConfigPath, getGlobalSecretsPath } from "../../paths.js";
import type { SecretsState, SecretsStorageError, SecretsStorageErrorCode } from "../types.js";
import { decodeSecretsV2, type SecretsDocumentV2, serializeSecretsV2 } from "./secrets.js";

/**
 * Write-ahead log for the config+secrets aggregate: a `.recovery` sidecar holding the
 * prior state of both files so an interrupted credential mutation can be replayed or
 * rolled back on the next startup.
 */
const SecretsRecoveryRecordSchema = z
  .object({
    version: z.literal(1),
    previousConfigFileExisted: z.boolean(),
    previousConfig: z.unknown(),
    previousFileExisted: z.boolean(),
    previousSecrets: z
      .object({
        providers: z.record(z.string(), z.unknown()),
      })
      .strict(),
  })
  .strict();

export type SecretsRecoveryRecord = z.infer<typeof SecretsRecoveryRecordSchema>;

const SecretsRecoveryRecordV2Schema = z
  .object({
    version: z.literal(2),
    previousFileExisted: z.boolean(),
    previousSecretsBase64: z.string().nullable(),
  })
  .strict()
  .refine(
    (record) => record.previousFileExisted === (record.previousSecretsBase64 !== null),
    "Secrets recovery snapshot does not match file state",
  );

export type SecretsRecoveryRecordV2 = z.infer<typeof SecretsRecoveryRecordV2Schema>;

export const getSecretsRecoveryPath = (): string => `${getGlobalSecretsPath()}.recovery`;

export const serializeSecretsState = (
  state: SecretsState,
): SecretsRecoveryRecord["previousSecrets"] => ({
  providers: { ...state.unknownSecrets, ...state.providers },
});

export const rollbackFailure = (cause: unknown): SecretsStorageError => {
  log("error", "secrets_rollback_failed", { error: getErrorMessage(cause) });
  return createError<SecretsStorageErrorCode>(
    "ROLLBACK_FAILED",
    "Failed to restore secrets after a partial persistence failure",
  );
};

const restoreRecoveryRecordSync = (record: SecretsRecoveryRecord): void => {
  if (record.previousConfigFileExisted) {
    writeJsonFileSync(getGlobalConfigPath(), record.previousConfig, 0o600);
  } else {
    removeFileSync(getGlobalConfigPath());
  }
  if (record.previousFileExisted) {
    writeJsonFileSync(getGlobalSecretsPath(), record.previousSecrets, 0o600);
  } else {
    removeFileSync(getGlobalSecretsPath());
  }
};

export type SecretsRecoveryRead =
  | { kind: "missing" }
  | { kind: "valid"; record: SecretsRecoveryRecord }
  | { kind: "invalid"; error: SecretsStorageError };

export const readSecretsRecovery = (): SecretsRecoveryRead => {
  const recoveryPath = getSecretsRecoveryPath();
  const readResult = readJsonFileSyncSafe<unknown>(recoveryPath);
  if (readResult.status === "missing") return { kind: "missing" };
  if (readResult.status === "corrupt") {
    return {
      kind: "invalid",
      error: rollbackFailure(new Error("Secrets recovery record is not valid JSON")),
    };
  }

  const parsed = SecretsRecoveryRecordSchema.safeParse(readResult.data);
  if (!parsed.success) {
    return {
      kind: "invalid",
      error: rollbackFailure(new Error("Secrets recovery record failed validation")),
    };
  }

  return { kind: "valid", record: parsed.data };
};

export type SecretsRecoveryReadV2 =
  | { kind: "missing" }
  | { kind: "valid"; record: SecretsRecoveryRecordV2; previousSecrets: SecretsDocumentV2 | null }
  | { kind: "invalid"; error: SecretsStorageError };

export const writeSecretsRecoveryV2 = async (
  previousSecrets: SecretsDocumentV2 | null,
): Promise<void> => {
  const record: SecretsRecoveryRecordV2 = {
    version: 2,
    previousFileExisted: previousSecrets !== null,
    previousSecretsBase64: previousSecrets
      ? Buffer.from(serializeSecretsV2(previousSecrets)).toString("base64")
      : null,
  };
  await atomicWriteFile(getSecretsRecoveryPath(), `${JSON.stringify(record, null, 2)}\n`, 0o600);
};

export const readSecretsRecoveryV2 = (): SecretsRecoveryReadV2 => {
  const readResult = readJsonFileSyncSafe<unknown>(getSecretsRecoveryPath());
  if (readResult.status === "missing") return { kind: "missing" };
  if (readResult.status === "corrupt") {
    return {
      kind: "invalid",
      error: rollbackFailure(new Error("Secrets recovery record is not valid JSON")),
    };
  }
  const parsed = SecretsRecoveryRecordV2Schema.safeParse(readResult.data);
  if (!parsed.success) {
    return {
      kind: "invalid",
      error: rollbackFailure(new Error("Secrets recovery record failed validation")),
    };
  }
  try {
    return {
      kind: "valid",
      record: parsed.data,
      previousSecrets: parsed.data.previousSecretsBase64
        ? decodeSecretsV2(Buffer.from(parsed.data.previousSecretsBase64, "base64"))
        : null,
    };
  } catch (cause) {
    return { kind: "invalid", error: rollbackFailure(cause) };
  }
};

export const reconcileSecretsRecoveryV2AtStartup =
  async (): Promise<SecretsStorageError | null> => {
    const recovery = readSecretsRecoveryV2();
    if (recovery.kind === "missing") return null;
    if (recovery.kind === "invalid") return recovery.error;

    try {
      if (recovery.previousSecrets) {
        await atomicWriteFile(
          getGlobalSecretsPath(),
          new TextDecoder().decode(serializeSecretsV2(recovery.previousSecrets)),
          0o600,
        );
      } else {
        removeFileSync(getGlobalSecretsPath());
      }
      removeFileSync(getSecretsRecoveryPath());
      return null;
    } catch (cause) {
      return rollbackFailure(cause);
    }
  };

// The caller must hold the config-file transaction lock. Recovery covers config and
// secrets as one aggregate, so replaying it outside that lock can roll back an active
// writer in another process.
export const reconcileSecretsRecoveryAtStartup = (): SecretsStorageError | null => {
  const recovery = readSecretsRecovery();
  if (recovery.kind === "missing") return null;
  if (recovery.kind === "invalid") return recovery.error;

  try {
    restoreRecoveryRecordSync(recovery.record);
    removeFileSync(getSecretsRecoveryPath());
    return null;
  } catch (cause) {
    return rollbackFailure(cause);
  }
};
