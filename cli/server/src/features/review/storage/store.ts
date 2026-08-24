import { mkdir, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { createError, getErrorMessage } from "@diffgazer/core/errors";
import { safeParseJson, sha256CanonicalJsonSync } from "@diffgazer/core/json";
import { err, ok, type Result } from "@diffgazer/core/result";
import { UuidSchema } from "@diffgazer/core/schemas/fields";
import { type SavedReview, SavedReviewSchema } from "@diffgazer/core/schemas/review";
import { atomicWriteFile, isNodeError, restrictDirectoryMode } from "../../../shared/lib/fs.js";
import { log } from "../../../shared/lib/log.js";
import {
  lenientReadSavedReview,
  normalizeSavedReviewLineFields,
  type ReviewSalvageDiagnostics,
} from "./lenient-read.js";
import { REVIEWS_DIR } from "./project-index.js";
import type { StoreError, StoreErrorCode } from "./types.js";

export type DetailedReviewRead =
  | { item: SavedReview; salvaged: false; diagnostics: null }
  | { item: SavedReview; salvaged: true; diagnostics: ReviewSalvageDiagnostics };

const createStoreError = createError<StoreErrorCode>;

// `execution` is the runtime view SavedReviewSchema derives from
// `executionSnapshot` on read, so it never lands on disk: persisting it would
// duplicate the whole receipt and issue list into every review file.
function serializeReview(review: SavedReview): string {
  const { execution: _execution, ...persisted } = review;
  return `${JSON.stringify(persisted, null, 2)}\n`;
}

// Return a path-free client message; log the raw cause (which carries the absolute
// daemon path) server-side so clients never see host filesystem internals.
function storeIoError(
  code: StoreErrorCode,
  message: string,
  path: string,
  cause: unknown,
): StoreError {
  log("warn", "review_store_io_error", { code, path, cause: getErrorMessage(cause) });
  return createStoreError(code, message);
}

function reviewFilePath(reviewId: string): string {
  const parsedId = UuidSchema.safeParse(reviewId);
  if (!parsedId.success) throw new Error("Invalid review id");

  const filePath = resolve(REVIEWS_DIR, `${parsedId.data}.json`);
  const relativePath = relative(REVIEWS_DIR, filePath);
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error("Review path escapes the collection directory");
  }
  return filePath;
}

async function safeReadFile(path: string): Promise<Result<string, StoreError>> {
  try {
    return ok(await readFile(path, "utf-8"));
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return err(createStoreError("NOT_FOUND", "review not found"));
    }
    if (isNodeError(error, "EACCES") || isNodeError(error, "EPERM")) {
      return err(storeIoError("PERMISSION_ERROR", "Permission denied reading review", path, error));
    }
    return err(storeIoError("READ_ERROR", "Failed to read review", path, error));
  }
}

async function ensureReviewsDir(): Promise<Result<void, StoreError>> {
  try {
    await mkdir(REVIEWS_DIR, { recursive: true, mode: 0o700 });
    await restrictDirectoryMode(REVIEWS_DIR, 0o700);
    return ok(undefined);
  } catch (error) {
    if (isNodeError(error, "EACCES")) {
      return err(
        storeIoError(
          "PERMISSION_ERROR",
          "Permission denied creating review directory",
          REVIEWS_DIR,
          error,
        ),
      );
    }
    return err(
      storeIoError("WRITE_ERROR", "Failed to create review directory", REVIEWS_DIR, error),
    );
  }
}

async function safeAtomicWrite(path: string, content: string): Promise<Result<void, StoreError>> {
  try {
    await atomicWriteFile(path, content);
    return ok(undefined);
  } catch (error) {
    if (isNodeError(error, "EACCES")) {
      return err(storeIoError("PERMISSION_ERROR", "Permission denied writing review", path, error));
    }
    return err(storeIoError("WRITE_ERROR", "Failed to write review", path, error));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The immutable receipt identity is the SHA-256 of this exact projection; a
// missing field hashes as `null`, so a malformed receipt simply fails to match
// instead of throwing on the canonical-JSON encode.
function fingerprintInput(receipt: Record<string, unknown>, limits: unknown): unknown {
  return {
    authentication: receipt.authentication ?? null,
    configurationId: receipt.configurationId ?? null,
    configurationRevision: receipt.configurationRevision ?? null,
    credentialReferenceIdentity: receipt.credentialReferenceIdentity ?? null,
    installationId: receipt.installationId ?? null,
    productId: receipt.productId ?? null,
    transportFamily: receipt.transportFamily ?? null,
    modelId: receipt.modelId ?? null,
    normalizedEndpoint: receipt.normalizedEndpoint ?? null,
    region: receipt.region ?? null,
    workspaceAccountReference: receipt.workspaceAccountReference ?? null,
    runtime: receipt.runtime ?? null,
    structuredOutputSchemaSha256: receipt.structuredOutputSchemaSha256 ?? null,
    noticeVersion: receipt.noticeVersion ?? null,
    limits,
  };
}

/**
 * No surface ever let a user choose an output-token budget, so a persisted
 * `limits.maxOutputTokens` is the retired default's fossil rather than a
 * choice. Records written while it existed hashed their execution fingerprint
 * over limits that included it, so dropping the key alone would leave every one
 * of them failing the receipt identity check and losing its outcome to the
 * lenient salvage. The identity is therefore re-derived over the retired
 * domain, and only when the record still proves its own legacy fingerprint —
 * a hand-edited receipt fails that proof and is left to fail validation.
 */
function migrateRetiredOutputTokenLimit(execution: unknown): unknown {
  if (!isRecord(execution) || !isRecord(execution.receipt)) return execution;
  const { receipt } = execution;
  if (!isRecord(receipt.limits) || !("maxOutputTokens" in receipt.limits)) return execution;

  const legacyFingerprint = sha256CanonicalJsonSync(fingerprintInput(receipt, receipt.limits));
  if (legacyFingerprint !== receipt.executionFingerprint) return execution;

  const { maxOutputTokens: _retired, ...limits } = receipt.limits;
  const executionFingerprint = sha256CanonicalJsonSync(fingerprintInput(receipt, limits));
  return {
    ...execution,
    // The durable snapshot mirrors its receipt's identity, so it moves with it.
    ...(execution.executionFingerprint === receipt.executionFingerprint
      ? { executionFingerprint }
      : {}),
    receipt: { ...receipt, limits, executionFingerprint },
  };
}

function migrateRetiredLimits(input: unknown): unknown {
  if (!isRecord(input)) return input;
  const migrated = { ...input };
  if ("executionSnapshot" in migrated) {
    migrated.executionSnapshot = migrateRetiredOutputTokenLimit(migrated.executionSnapshot);
  }
  if ("execution" in migrated) {
    migrated.execution = migrateRetiredOutputTokenLimit(migrated.execution);
  }
  return migrated;
}

async function readDetailed(id: string): Promise<Result<DetailedReviewRead, StoreError>> {
  const readResult = await safeReadFile(reviewFilePath(id));
  if (!readResult.ok) return readResult;

  // Only a schema-validation failure on valid JSON is salvaged; JSON corruption
  // stays a PARSE_ERROR.
  const parseResult = safeParseJson(readResult.value);
  if (!parseResult.ok) {
    return err(createStoreError("PARSE_ERROR", `review: ${parseResult.error}`));
  }

  const record = migrateRetiredLimits(parseResult.value);
  const validation = SavedReviewSchema.safeParse(record);
  if (validation.success) {
    return ok({
      item: normalizeSavedReviewLineFields(validation.data),
      salvaged: false,
      diagnostics: null,
    });
  }

  // Salvage older immutable reviews the strict write-side schema rejects so they
  // remain readable through review and history views.
  const salvaged = lenientReadSavedReview(record);
  if (salvaged !== null) {
    return ok({
      item: normalizeSavedReviewLineFields(salvaged.item),
      salvaged: true,
      diagnostics: salvaged.diagnostics,
    });
  }

  return err(
    createStoreError("VALIDATION_ERROR", "review failed validation", validation.error.message),
  );
}

async function read(id: string): Promise<Result<SavedReview, StoreError>> {
  const result = await readDetailed(id);
  if (!result.ok) return result;
  return ok(result.value.item);
}

async function write(review: SavedReview): Promise<Result<void, StoreError>> {
  const path = reviewFilePath(review.metadata.id);
  const ensureResult = await ensureReviewsDir();
  if (!ensureResult.ok) return ensureResult;

  const validation = SavedReviewSchema.safeParse(review);
  if (!validation.success) {
    return err(
      createStoreError("VALIDATION_ERROR", "review failed validation", validation.error.message),
    );
  }

  return safeAtomicWrite(path, serializeReview(validation.data));
}

/** The single on-disk review collection: one JSON document per review id. */
export const reviewStore = { read, readDetailed, write };
