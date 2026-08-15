export interface AppError<C extends string = string> {
  code: C;
  message: string;
  details?: string;
}

export const createError = <C extends string>(
  code: C,
  message: string,
  details?: string,
): AppError<C> => ({ code, message, details });

export function getErrorMessage(error: unknown, fallback?: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (fallback !== undefined) {
    return fallback;
  }

  return String(error);
}

export function getErrorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}
