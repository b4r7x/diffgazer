import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { StoreError } from "./storage/persistence.js";
import { ErrorCode } from "@repo/schemas/errors";
import { errorCodeToStatus } from "./validation.js";
import type { core } from "zod";

export const errorResponse = (
  ctx: Context,
  message: string,
  code: string,
  status: number
): Response => ctx.json({ error: { message, code } }, status as ContentfulStatusCode);

export const handleStoreError = (ctx: Context, error: StoreError): Response => {
  const status = errorCodeToStatus(error.code);
  return errorResponse(ctx, error.message, error.code, status);
};

export const zodErrorHandler = <T>(
  result: { success: true; data: T } | { success: false; error: core.$ZodError },
  ctx: Context
): Response | undefined => {
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const message = firstIssue?.message ?? "Invalid body";
    return errorResponse(
      ctx,
      message,
      ErrorCode.VALIDATION_ERROR,
      400
    );
  }
  return undefined;
};
