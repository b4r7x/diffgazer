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
