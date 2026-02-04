import type { Context } from "hono";

export const errorResponse = (
  c: Context,
  message: string,
  code: string,
  status: number
): Response => c.json({ error: { message, code } }, status);
