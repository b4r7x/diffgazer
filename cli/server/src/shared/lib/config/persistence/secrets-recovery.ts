import { createError, getErrorMessage } from "@diffgazer/core/errors";
import { z } from "zod";
import { readJsonFileSyncSafe, removeFileSync, writeJsonFileSync } from "../../fs.js";
import { log } from "../../log.js";
import { getGlobalConfigPath, getGlobalSecretsPath } from "../../paths.js";
import type { SecretsState, SecretsStorageError, SecretsStorageErrorCode } from "../types.js";

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
