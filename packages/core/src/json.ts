import type { Result } from "./result.js";
import { ok, err } from "./result.js";

export function safeParseJson<E>(
  content: string,
  errorFactory: (message: string, details?: string) => E
): Result<unknown, E> {
  try {
    return ok(JSON.parse(content));
  } catch (error) {
    const details = error instanceof Error ? error.message : undefined;
    return err(errorFactory("Invalid JSON", details));
  }
}
