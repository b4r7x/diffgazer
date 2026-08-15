import { createError, getErrorMessage } from "@diffgazer/core/errors";
import { z } from "zod";
import {
  atomicWriteFile,
  readJsonFileSyncSafe,
  removeFileSyncDurable,
  syncParentDirectorySync,
} from "../../fs.js";
import { log } from "../../log.js";
import { getGlobalConfigPath, getGlobalSecretsPath } from "../../paths.js";
import type { SecretsStorageError, SecretsStorageErrorCode } from "../types.js";

/**
 * Write-ahead log for the config+secrets commit: a `.recovery` sidecar holding
 * the exact prior bytes of both files so an interrupted two-file mutation is
 * rolled back on the next startup. Bytes, not parsed JSON: unknown records from
 * a newer binary must be restored byte-for-byte.
 */
const FileSnapshotSchema = z
  .object({
    existed: z.boolean(),
    base64: z.string().nullable(),
  })
  .strict()
  .refine(
    (snapshot) => snapshot.existed === (snapshot.base64 !== null),
    "Recovery snapshot does not match file state",
  );

const DocumentRecoveryRecordSchema = z
  .object({
    version: z.literal(2),
    previousConfig: FileSnapshotSchema,
    previousSecrets: FileSnapshotSchema,
  })
  .strict();

export type DocumentRecoveryRecord = z.infer<typeof DocumentRecoveryRecordSchema>;

export const getSecretsRecoveryPath = (): string => `${getGlobalSecretsPath()}.recovery`;

const rollbackFailure = (cause: unknown): SecretsStorageError => {
  log("error", "secrets_rollback_failed", { error: getErrorMessage(cause) });
  return createError<SecretsStorageErrorCode>(
    "ROLLBACK_FAILED",
    "Failed to restore secrets after a partial persistence failure",
  );
};

const snapshotOf = (bytes: Uint8Array | null): z.infer<typeof FileSnapshotSchema> => ({
  existed: bytes !== null,
  base64: bytes === null ? null : Buffer.from(bytes).toString("base64"),
});

export const writeDocumentRecovery = async (previous: {
  readonly config: Uint8Array | null;
  readonly secrets: Uint8Array | null;
}): Promise<DocumentRecoveryRecord> => {
  const record: DocumentRecoveryRecord = {
    version: 2,
    previousConfig: snapshotOf(previous.config),
    previousSecrets: snapshotOf(previous.secrets),
  };
  await rewriteDocumentRecovery(record);
  return record;
};

/**
 * Re-establish a durable WAL record after an ambiguous clear. The caller must
 * hold the config and secrets transaction locks and must do this before
 * attempting any compensating restore, because a partial restore still needs
 * a journal for the next initialized store to finish safely.
 */
export const rewriteDocumentRecovery = async (record: DocumentRecoveryRecord): Promise<void> => {
  await atomicWriteFile(getSecretsRecoveryPath(), `${JSON.stringify(record, null, 2)}\n`, 0o600);
};

export type DocumentRecoveryRead =
  | { kind: "missing" }
  | { kind: "valid"; record: DocumentRecoveryRecord }
  | { kind: "invalid"; error: SecretsStorageError };

export const readDocumentRecovery = (): DocumentRecoveryRead => {
  const readResult = readJsonFileSyncSafe<unknown>(getSecretsRecoveryPath());
  if (readResult.status === "missing") return { kind: "missing" };
  if (readResult.status === "corrupt") {
    return { kind: "invalid", error: rollbackFailure(new Error(readResult.error)) };
  }
  const parsed = DocumentRecoveryRecordSchema.safeParse(readResult.data);
  if (!parsed.success) {
    return { kind: "invalid", error: rollbackFailure(parsed.error) };
  }
  return { kind: "valid", record: parsed.data };
};

const restoreSnapshot = async (
  filePath: string,
  snapshot: z.infer<typeof FileSnapshotSchema>,
): Promise<void> => {
  if (snapshot.base64 === null) {
    removeFileSyncDurable(filePath);
    return;
  }
  // Bytes, never a UTF-8 string round trip: decoding here would replace every
  // ill-formed sequence with U+FFFD and break the byte-for-byte restore contract.
  await atomicWriteFile(filePath, Buffer.from(snapshot.base64, "base64"), 0o600);
};

export const clearDocumentRecovery = (options?: {
  readonly syncParentWhenMissing?: boolean;
}): void => {
  const recoveryPath = getSecretsRecoveryPath();
  if (!removeFileSyncDurable(recoveryPath) && options?.syncParentWhenMissing) {
    syncParentDirectorySync(recoveryPath);
  }
};

/**
 * Roll both files back to their pre-mutation bytes. The caller must hold the
 * config and secrets transaction locks: replaying outside them can undo another
 * process's committed write.
 */
export const restoreDocumentRecovery = async (
  record: DocumentRecoveryRecord,
): Promise<SecretsStorageError | null> => {
  try {
    await restoreSnapshot(getGlobalConfigPath(), record.previousConfig);
    await restoreSnapshot(getGlobalSecretsPath(), record.previousSecrets);
    clearDocumentRecovery({ syncParentWhenMissing: true });
    return null;
  } catch (cause) {
    return rollbackFailure(cause);
  }
};
