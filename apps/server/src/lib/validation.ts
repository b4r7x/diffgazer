import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { HTTPException } from "hono/http-exception";
import { isValidUuid, isValidProjectPath } from "@repo/core";
import type { StoreErrorCode } from "@repo/core/storage";

export { isRelativePath, isValidProjectPath } from "@repo/core";

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
