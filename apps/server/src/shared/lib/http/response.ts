import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ErrorCode } from "@stargazer/schemas/errors";
import type { core } from "zod";

const VALID_ERROR_STATUSES: Record<number, ContentfulStatusCode> = {
  400: 400,
  401: 401,
  403: 403,
  404: 404,
  409: 409,
  422: 422,
  429: 429,
  500: 500,
  502: 502,
  503: 503,
};

export const errorResponse = (
  ctx: Context,
  message: string,
  code: string,
  status: number
): Response => ctx.json({ error: { message, code } }, VALID_ERROR_STATUSES[status] ?? 500);

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
