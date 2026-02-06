import type { ZodType } from "zod";
import { UuidSchema } from "@stargazer/schemas";
import { type Result, ok, err, safeParseJson } from "@stargazer/core";

export const isValidUuid = (id: string): boolean => UuidSchema.safeParse(id).success;

export const validateSchema = <T, E>(
  value: unknown,
  schema: ZodType<T>,
  errorFactory: (message: string) => E
): Result<T, E> => {
  const result = schema.safeParse(value);
  if (!result.success) {
    return err(errorFactory(result.error.message));
  }
  return ok(result.data);
};

export const parseAndValidate = <T, E>(
  content: string,
  schema: ZodType<T>,
  parseErrorFactory: (message: string) => E,
  validationErrorFactory: (message: string) => E
): Result<T, E> => {
  const parseResult = safeParseJson(content, parseErrorFactory);
  if (!parseResult.ok) {
    return err(parseResult.error);
  }
  return validateSchema(parseResult.value, schema, validationErrorFactory);
};

export const isRelativePath = (value: string): boolean => {
  if (value.startsWith("/") || value.startsWith("\\") || /^[a-zA-Z]:/.test(value)) {
    return false;
  }
  if (value.includes("..") || value.includes("\0")) {
    return false;
  }
  return true;
};

export const isValidProjectPath = (value: string): boolean => {
  if (value.includes("..") || value.includes("\0")) {
    return false;
  }
  return true;
};
