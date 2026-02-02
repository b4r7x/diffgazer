import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { HTTPException } from "hono/http-exception";
import type { ZodType, ZodTypeDef } from "zod";
import { UuidSchema } from "@repo/schemas";
import type { Result } from "@repo/core";
import { ok, err, safeParseJson } from "@repo/core";
import type { StoreErrorCode } from "../storage/index.js";

// Validation utilities (moved from @repo/core)

export { UuidSchema };

export function isValidUuid(id: string): boolean {
  return UuidSchema.safeParse(id).success;
}

export function assertValidUuid(id: string): string {
  if (!UuidSchema.safeParse(id).success) {
    throw new Error(`Invalid UUID format: ${id}`);
  }
  return id;
}

export function validateSchema<T, E>(
  value: unknown,
  schema: ZodType<T, ZodTypeDef, unknown>,
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
  schema: ZodType<T, ZodTypeDef, unknown>,
  parseErrorFactory: (message: string) => E,
  validationErrorFactory: (message: string) => E
): Result<T, E> {
  const parseResult = safeParseJson(content, parseErrorFactory);
  if (!parseResult.ok) {
    return err(parseResult.error);
  }
  return validateSchema(parseResult.value, schema, validationErrorFactory);
}

export function isRelativePath(path: string): boolean {
  if (path.startsWith("/") || path.startsWith("\\") || /^[a-zA-Z]:/.test(path)) {
    return false;
  }
  if (path.includes("..") || path.includes("\0")) {
    return false;
  }
  return true;
}

export function isValidProjectPath(path: string): boolean {
  if (path.includes("..") || path.includes("\0")) {
    return false;
  }
  return true;
}

// Hono-specific helpers

export function requireUuidParam(c: Context, paramName: string): string {
  const value = c.req.param(paramName);
  if (!isValidUuid(value)) {
    throw new HTTPException(400, {
      message: `Invalid ${paramName} format: expected UUID`,
    });
  }
  return value;
}

export function validateProjectPath(path: string | undefined): string | undefined {
  if (!path) return undefined;
  if (!isValidProjectPath(path)) {
    throw new HTTPException(400, {
      message: "Invalid projectPath: contains path traversal or null bytes",
    });
  }
  return path;
}

export function errorCodeToStatus(code: StoreErrorCode): ContentfulStatusCode {
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
}
