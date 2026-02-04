export type { AppError } from "@stargazer/core";
export { createError, getErrorMessage, toError } from "@stargazer/core";

export const isNodeError = (error: unknown, code: string): error is NodeJS.ErrnoException =>
  error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code;
