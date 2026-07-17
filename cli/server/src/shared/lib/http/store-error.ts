import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { SecretsStorageErrorCode } from "../config/types.js";
import type { ConfigServiceErrorCode, StoreErrorCode } from "./error-codes.js";
import type { ErrorStatus } from "./response.js";

export type StoreHttpErrorCode =
  | StoreErrorCode
  | SecretsStorageErrorCode
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
      return 400;
    case "PERMISSION_ERROR":
      return 403;
    case ErrorCode.NOT_FOUND:
    case ErrorCode.CONFIG_NOT_FOUND:
    case ErrorCode.PROVIDER_NOT_FOUND:
    case "SECRET_NOT_FOUND":
      return 404;
    case "CONCURRENCY_CONFLICT":
      return 409;
    case ErrorCode.INTERNAL_ERROR:
    case "PARSE_ERROR":
    case "WRITE_ERROR":
    case "KEYRING_UNAVAILABLE":
    case "KEYRING_READ_FAILED":
    case "KEYRING_WRITE_FAILED":
    case "KEYRING_DELETE_FAILED":
    case "SECRETS_MIGRATION_FAILED":
    case "PERSIST_FAILED":
    case "ROLLBACK_FAILED":
      return 500;
  }

  const unhandled: never = code;
  throw new Error(`Unhandled store error code: ${unhandled}`);
}
