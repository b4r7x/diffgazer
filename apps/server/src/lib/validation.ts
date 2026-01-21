import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { HTTPException } from "hono/http-exception";
import { isValidUuid } from "@repo/core";
import type { StoreErrorCode } from "@repo/core/storage";

export function requireUuidParam(c: Context, paramName: string): string {
  const value = c.req.param(paramName);
  if (!isValidUuid(value)) {
    throw new HTTPException(400, {
      message: `Invalid ${paramName} format: expected UUID`,
    });
  }
  return value;
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

export function validateProjectPath(path: string | undefined): string | undefined {
  if (!path) return undefined;
  if (!isRelativePath(path)) {
    throw new HTTPException(400, {
      message: "Invalid projectPath: must be a relative path without traversal",
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
