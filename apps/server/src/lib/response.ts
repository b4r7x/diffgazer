import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { StoreError } from "@repo/core/storage";
import { ErrorCode } from "@repo/schemas/errors";
import { errorCodeToStatus } from "./validation.js";

export function handleStoreError(ctx: Context, error: StoreError) {
  const status = errorCodeToStatus(error.code);
  return errorResponse(ctx, error.message, error.code, status);
}

export function zodErrorHandler<T>(
  result: { success: true; data: T } | { success: false; error: { errors: { message?: string }[] } },
  ctx: Context
): Response | undefined {
  if (!result.success) {
    return errorResponse(ctx, result.error.errors[0]?.message ?? "Invalid body", ErrorCode.VALIDATION_ERROR, 400);
  }
  return undefined;
}

export function errorResponse(
  ctx: Context,
  message: string,
  code: string,
  status: ContentfulStatusCode
) {
  return ctx.json({ error: { message, code } }, status);
}

export function ok<T>(ctx: Context, data: T) {
  return ctx.json(data);
}
