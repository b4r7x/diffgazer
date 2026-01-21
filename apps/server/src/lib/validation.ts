import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { HTTPException } from "hono/http-exception";
import { isValidUuid } from "@repo/core";
import type { StoreErrorCode } from "@repo/core/storage";

/**
 * Validate and return UUID or throw HTTPException.
 * Use this instead of validateUuidParam for cleaner control flow.
 */
export function requireUuidParam(c: Context, paramName: string): string {
  const value = c.req.param(paramName);
  if (!isValidUuid(value)) {
    throw new HTTPException(400, {
      message: `Invalid ${paramName} format: expected UUID`,
    });
  }
  return value;
}

/**
 * Validate optional query param is safe path (no traversal).
 * Returns the path if valid, undefined if not provided.
 * Throws HTTPException if path contains traversal attempts.
 */
export function validateProjectPath(path: string | undefined): string | undefined {
  if (!path) return undefined;
  // Block directory traversal attempts
  if (path.includes("..") || path.includes("\0")) {
    throw new HTTPException(400, {
      message: "Invalid projectPath: path traversal not allowed",
    });
  }
  return path;
}

/**
 * Map storage error codes to HTTP status codes.
 */
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
