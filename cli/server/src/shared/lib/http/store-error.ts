import type { AppError } from "@diffgazer/core/errors";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { Context } from "hono";
import type { ConfigurationActionErrorCode } from "../config/types.js";
import type { ConfigServiceErrorCode, StoreErrorCode } from "./error-codes.js";
import { type ErrorStatus, errorResponse } from "./response.js";

export type StoreHttpErrorCode =
  | StoreErrorCode
  | ConfigurationActionErrorCode
  | ConfigServiceErrorCode
  | typeof ErrorCode.CONFIG_NOT_FOUND;

export function storeErrorStatus(code: StoreHttpErrorCode): ErrorStatus {
  switch (code) {
    case ErrorCode.VALIDATION_ERROR:
    case ErrorCode.CREDENTIAL_INVALID:
    case ErrorCode.API_KEY_MISSING:
    case "MODEL_ERROR":
    case "INVALID_BODY":
    case "STORAGE_NOT_CONFIGURED":
    case "INVALID_ACTION":
    case "CONFIGURATION_UNSUPPORTED":
      return 400;
    case "PERMISSION_ERROR":
      return 403;
    case ErrorCode.NOT_FOUND:
    case ErrorCode.CONFIG_NOT_FOUND:
    case ErrorCode.PROVIDER_NOT_FOUND:
    case "SECRET_NOT_FOUND":
    case "CONFIGURATION_NOT_FOUND":
      return 404;
    case "CONCURRENCY_CONFLICT":
    case "CONFIGURATION_CONFLICT":
      return 409;
    case ErrorCode.INTERNAL_ERROR:
    case "PARSE_ERROR":
    case "WRITE_ERROR":
    case "KEYRING_UNAVAILABLE":
    case "KEYRING_READ_FAILED":
    case "KEYRING_WRITE_FAILED":
    case "KEYRING_DELETE_FAILED":
    case "SECRETS_MIGRATION_FAILED":
    case "SECRET_BINDING_FAILED":
    case "PERSIST_FAILED":
    case "ROLLBACK_FAILED":
      return 500;
  }

  const unhandled: never = code;
  throw new Error(`Unhandled store error code: ${unhandled}`);
}

export function handleStoreError(ctx: Context, error: AppError<StoreHttpErrorCode>): Response {
  return errorResponse(ctx, error.message, error.code, storeErrorStatus(error.code));
}
