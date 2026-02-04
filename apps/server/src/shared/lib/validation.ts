import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { HTTPException } from "hono/http-exception";
import type { ZodType } from "zod";
import { UuidSchema } from "@stargazer/schemas";
import type { Result } from "./result.js";
import { ok, err } from "./result.js";
import { safeParseJson } from "./json.js";
import type { StoreErrorCode } from "./storage/persistence.js";

export { UuidSchema };

export const isValidUuid = (id: string): boolean => UuidSchema.safeParse(id).success;

export const assertValidUuid = (id: string): string => {
  if (!UuidSchema.safeParse(id).success) {
    throw new Error(`Invalid UUID format: ${id}`);
  }
  return id;
};

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

export const requireUuidParam = (c: Context, paramName: string): string => {
  const value = c.req.param(paramName);
  if (!isValidUuid(value)) {
    throw new HTTPException(400, {
      message: `Invalid ${paramName} format: expected UUID`,
    });
  }
  return value;
};

export const validateProjectPath = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  if (!isValidProjectPath(value)) {
    throw new HTTPException(400, {
      message: "Invalid projectPath: contains path traversal or null bytes",
    });
  }
  return value;
};

export const errorCodeToStatus = (code: StoreErrorCode): ContentfulStatusCode => {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "VALIDATION_ERROR":
      return 400;
    case "PERMISSION_ERROR":
      return 403;
    default:
      return 500;
  }
};
