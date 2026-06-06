import { CancelError, error, toErrorMessage } from "./terminal.js";

export function withErrorHandler<TArgs extends unknown[]>(fn: (...args: TArgs) => Promise<void>) {
  return async (...args: TArgs) => {
    try {
      await fn(...args);
    } catch (e) {
      if (e instanceof CancelError) throw e;
      error(toErrorMessage(e));
      process.exit(1);
    }
  };
}
