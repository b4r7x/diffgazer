import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
// `@hono/zod-validator`'s Hook surfaces zod's internal `$ZodError`, which is a
// distinct type from the public `ZodError` (it lacks `format`/`flatten`/etc.).
// The validator callback below must match that internal type exactly.
import type { core } from "zod";

const VALID_ERROR_STATUSES = {
  400: 400,
  401: 401,
  403: 403,
  404: 404,
  409: 409,
  413: 413,
  422: 422,
  429: 429,
  500: 500,
  502: 502,
  503: 503,
} satisfies Record<number, ContentfulStatusCode>;

export type ErrorStatus = keyof typeof VALID_ERROR_STATUSES;

export const errorResponse = (
  ctx: Context,
  message: string,
  code: string,
  status: ErrorStatus
): Response => ctx.json({ error: { message, code } }, VALID_ERROR_STATUSES[status]);

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
