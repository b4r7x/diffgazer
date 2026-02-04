import { getErrorMessage } from "./errors.js";

interface ErrorRule<C> {
  patterns: string[];
  code: C;
  message: string;
}

export const createErrorClassifier = <C extends string>(
  rules: ErrorRule<C>[],
  defaultCode: C,
  defaultMessage: (original: string) => string
): ((error: unknown) => { code: C; message: string }) =>
  (error) => {
    const msg = getErrorMessage(error).toLowerCase();
    for (const rule of rules) {
      if (rule.patterns.some((pattern) => msg.includes(pattern))) {
        return { code: rule.code, message: rule.message };
      }
    }
    return { code: defaultCode, message: defaultMessage(getErrorMessage(error)) };
  };
