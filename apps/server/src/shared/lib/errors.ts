export interface AppError<C extends string = string> {
  code: C;
  message: string;
  details?: string;
}

export const createError = <C extends string>(
  code: C,
  message: string,
  details?: string
): AppError<C> => ({ code, message, details });

export const isNodeError = (error: unknown, code: string): error is NodeJS.ErrnoException =>
  error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code;

export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

export const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === "AbortError";
