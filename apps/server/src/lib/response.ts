import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { GitError } from "@repo/schemas/git";

export function errorResponse(
  c: Context,
  message: string,
  code: GitError["code"],
  status: ContentfulStatusCode
) {
  return c.json({ success: false, error: { message, code } }, status);
}

export function successResponse<T>(c: Context, data: T) {
  return c.json({ success: true, data });
}
