import type { ZodSchema } from "zod";
import type { Result } from "../result.js";
import { ok, err } from "../result.js";
import { safeParseJson } from "../json.js";

export function validateSchema<T, E>(
  value: unknown,
  schema: ZodSchema<T>,
  errorFactory: (message: string) => E
): Result<T, E> {
  const result = schema.safeParse(value);
  if (!result.success) {
    return err(errorFactory(result.error.message));
  }
  return ok(result.data);
}

export function parseAndValidate<T, E>(
  content: string,
  schema: ZodSchema<T>,
  parseErrorFactory: (message: string) => E,
  validationErrorFactory: (message: string) => E
): Result<T, E> {
  const parseResult = safeParseJson(content, parseErrorFactory);
  if (!parseResult.ok) {
    return err(parseResult.error);
  }
  return validateSchema(parseResult.value, schema, validationErrorFactory);
}

/**
 * Check if a path is relative (not absolute and without path traversal).
 */
export function isRelativePath(path: string): boolean {
  if (path.startsWith("/") || path.startsWith("\\") || /^[a-zA-Z]:/.test(path)) {
    return false;
  }
  if (path.includes("..") || path.includes("\0")) {
    return false;
  }
  return true;
}

/**
 * Check if a project path is valid (no path traversal or null bytes).
 */
export function isValidProjectPath(path: string): boolean {
  if (path.includes("..") || path.includes("\0")) {
    return false;
  }
  return true;
}
