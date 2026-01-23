/** Base error interface with typed code, message, and optional details. */
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

export function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/** Type guard for AbortController cancellation errors. */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
