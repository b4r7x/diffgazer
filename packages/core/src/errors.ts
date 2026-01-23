/**
 * Base error interface for all domain errors in the application.
 *
 * Domain-specific error types should use this pattern:
 * ```typescript
 * type MyErrorCode = "NOT_FOUND" | "INVALID_INPUT";
 * type MyError = AppError<MyErrorCode>;
 * ```
 *
 * For errors that need additional context (e.g., file path), create a
 * specialized interface that extends this pattern:
 * ```typescript
 * interface FileIOError extends AppError<FileIOErrorCode> {
 *   path: string;
 * }
 * ```
 *
 * @template C - Union of string literal error codes for this domain
 */
export interface AppError<C extends string = string> {
  /** Domain-specific error code identifying the error type */
  code: C;
  /** Human-readable error message */
  message: string;
  /** Optional additional context (e.g., stack traces, underlying errors) */
  details?: string;
}

/**
 * Creates an AppError with the given code, message, and optional details.
 *
 * @example
 * ```typescript
 * const error = createError("NOT_FOUND", "User not found", "ID: 123");
 * ```
 */
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
