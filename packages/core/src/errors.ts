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
