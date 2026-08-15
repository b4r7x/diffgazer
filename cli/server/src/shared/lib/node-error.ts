export const isNodeError = (error: unknown, code?: string): error is NodeJS.ErrnoException =>
  error instanceof Error &&
  "code" in error &&
  (code === undefined || (error as NodeJS.ErrnoException).code === code);
