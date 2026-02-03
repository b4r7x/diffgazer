export function getErrorMessage(error: unknown, fallback?: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (fallback !== undefined) {
    return fallback;
  }

  return String(error);
}
