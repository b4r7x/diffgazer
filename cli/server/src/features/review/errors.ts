import type { Context } from "hono";
import { errorResponse } from "../../shared/lib/http/response.js";
import { storeErrorStatus } from "../../shared/lib/http/store-error.js";
import type { StoreError } from "./storage/types.js";

export const handleStoreError = (ctx: Context, error: StoreError): Response => {
  const status = storeErrorStatus(error.code);
  return errorResponse(ctx, error.message, error.code, status);
};
