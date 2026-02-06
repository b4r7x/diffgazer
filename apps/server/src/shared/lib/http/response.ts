import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ErrorCode } from "@stargazer/schemas/errors";
import type { core } from "zod";

export const errorResponse = (
  ctx: Context,
  message: string,
  code: string,
  status: number
): Response => ctx.json({ error: { message, code } }, status as ContentfulStatusCode);

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
