import type { CatalogErrorCode } from "@diffgazer/core/schemas/config";
import type { ErrorCode } from "@diffgazer/core/schemas/errors";

/**
 * Error codes the config service emits on its credential/model/activation paths.
 * Declaring them as a closed union lets the router forward `result.error.code`
 * straight into the typed `errorResponse` wire vocabulary.
 */
export type ConfigServiceErrorCode =
  | typeof ErrorCode.CREDENTIAL_INVALID
  | typeof ErrorCode.PROVIDER_NOT_FOUND
  | typeof ErrorCode.API_KEY_MISSING
  | typeof ErrorCode.INTERNAL_ERROR
  | "MODEL_ERROR"
  | "INVALID_BODY";

/**
 * Error codes getProviderModels can return, so the router can map them to HTTP
 * statuses exhaustively instead of bucketing everything into 500.
 */
export type ProviderModelsErrorCode = CatalogErrorCode | typeof ErrorCode.VALIDATION_ERROR;

export type StoreErrorCode =
  | "NOT_FOUND"
  | "PARSE_ERROR"
  | "VALIDATION_ERROR"
  | "WRITE_ERROR"
  | "PERMISSION_ERROR";
