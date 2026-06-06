import type { Context } from "hono";
import { type ErrorStatus, errorResponse } from "../../shared/lib/http/response.js";
import type {
  StoreError,
  StoreErrorCode,
} from "../../shared/lib/storage/types.js";

const errorCodeToStatus = (code: StoreErrorCode): ErrorStatus => {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "VALIDATION_ERROR":
      return 400;
    case "PERMISSION_ERROR":
      return 403;
    default:
      return 500;
  }
};

export const handleStoreError = (ctx: Context, error: StoreError): Response => {
  const status = errorCodeToStatus(error.code);
  return errorResponse(ctx, error.message, error.code, status);
};
