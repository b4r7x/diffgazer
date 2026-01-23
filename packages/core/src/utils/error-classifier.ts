import { getErrorMessage } from "../errors.js";

interface ErrorRule<C> {
  patterns: string[];
  code: C;
  message: string;
}

export function createErrorClassifier<C extends string>(
  rules: ErrorRule<C>[],
  defaultCode: C,
  defaultMessage: (original: string) => string
): (error: unknown) => { code: C; message: string } {
  return (error) => {
    const msg = getErrorMessage(error).toLowerCase();
    for (const rule of rules) {
      if (rule.patterns.some((p) => msg.includes(p))) {
        return { code: rule.code, message: rule.message };
      }
    }
    return { code: defaultCode, message: defaultMessage(getErrorMessage(error)) };
  };
}
