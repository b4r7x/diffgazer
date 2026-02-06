import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { StoreError, StoreErrorCode } from "../storage/persistence.js";
import { ErrorCode } from "@stargazer/schemas/errors";
import type { core } from "zod";

const errorCodeToStatus = (code: StoreErrorCode): ContentfulStatusCode => {
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
