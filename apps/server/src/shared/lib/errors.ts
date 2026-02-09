import { getErrorMessage } from "@diffgazer/core/errors";

export interface ErrorRule<C extends string> {
  patterns: string[];
  code: C;
  message: string;
}

export function classifyError<C extends string>(
  error: unknown,
  rules: ErrorRule<C>[],
  fallback: { code: C; message: (msg: string) => string },
): { code: C; message: string } {
  const msg = getErrorMessage(error).toLowerCase();
  for (const rule of rules) {
    if (rule.patterns.some((pattern) => msg.includes(pattern))) {
      return { code: rule.code, message: rule.message };
    }
  }
  return { code: fallback.code, message: fallback.message(getErrorMessage(error)) };
}
