export interface AppError<C extends string = string> {
  code: C;
  message: string;
  details?: string;
}

export function createError<C extends string>(
  code: C,
  message: string,
  details?: string
): AppError<C> {
  return { code, message, details };
}

/** Type guard for Node.js system errors (ENOENT, EACCES, etc.) */
export function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code;
}

/** Extract error message safely from unknown error */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Ensure value is an Error instance */
export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Check if error is an AbortError (from AbortController).
 * Useful for ignoring cancelled requests in streaming operations.
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
