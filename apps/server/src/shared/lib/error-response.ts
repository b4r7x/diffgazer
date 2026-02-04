import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export const errorResponse = (
  c: Context,
  message: string,
  code: string,
  status: number
): Response => c.json({ error: { message, code } }, status as ContentfulStatusCode);
