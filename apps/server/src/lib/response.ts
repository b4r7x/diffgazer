import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Result } from "@repo/core";
import type { StoreError } from "@repo/core/storage";
import { errorCodeToStatus } from "./validation.js";

export function handleStoreError(c: Context, error: StoreError) {
  const status = errorCodeToStatus(error.code);
  return errorResponse(c, error.message, error.code, status);
}

export function zodErrorHandler<T>(
  result: { success: true; data: T } | { success: false; error: { errors: { message?: string }[] } },
  c: Context
): Response | undefined {
  if (!result.success) {
    return errorResponse(c, result.error.errors[0]?.message ?? "Invalid body", "VALIDATION_ERROR", 400);
  }
  return undefined;
}

export function errorResponse(
  c: Context,
  message: string,
  code: string,
  status: ContentfulStatusCode
) {
  return c.json({ success: false, error: { message, code } }, status);
}

export function successResponse<T>(c: Context, data: T) {
  return c.json({ success: true, data });
}
