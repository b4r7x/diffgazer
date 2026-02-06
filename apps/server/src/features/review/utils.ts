import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ErrorCode } from "@stargazer/schemas/errors";
import {
  errorResponse,
} from "../../shared/lib/http/response.js";
import { isValidProjectPath } from "../../shared/lib/validation.js";
import type {
  StoreError,
  StoreErrorCode,
} from "../../shared/lib/storage/types.js";
import type { TraceRef } from "@stargazer/schemas/review";
import type { ReviewAbort } from "./types.js";

export const parseProjectPath = (
  c: Context,
  options: { required?: boolean } = {},
): { ok: true; value?: string } | { ok: false; response: Response } => {
  const projectPath = c.req.query("projectPath");
  if (!projectPath) {
    if (options.required) {
      return {
        ok: false,
        response: errorResponse(
          c,
          "projectPath required",
          ErrorCode.VALIDATION_ERROR,
          400,
        ),
      };
    }
    return { ok: true, value: undefined };
  }

  if (!isValidProjectPath(projectPath)) {
    return {
      ok: false,
      response: errorResponse(
        c,
        "Invalid projectPath: contains path traversal or null bytes",
        ErrorCode.VALIDATION_ERROR,
        400,
      ),
    };
  }

  return { ok: true, value: projectPath };
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

export const handleStoreError = (ctx: Context, error: StoreError): Response => {
  const status = errorCodeToStatus(error.code);
  return errorResponse(ctx, error.message, error.code, status);
};

export function reviewAbort(
  message: string,
  code: string,
  step?: ReviewAbort["step"],
): ReviewAbort {
  return { kind: "review_abort", message, code, step };
}

export function isReviewAbort(error: unknown): error is ReviewAbort {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as Partial<ReviewAbort>;
  return (
    candidate.kind === "review_abort" &&
    typeof candidate.message === "string" &&
    typeof candidate.code === "string"
  );
}

export function summarizeOutput(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value === "string") {
    const lines = value.split("\n").length;
    const chars = value.length;
    if (chars > 100) {
      return `${chars} chars, ${lines} lines`;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return `Array[${value.length}]`;
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);
    return `Object{${keys.slice(0, 3).join(", ")}${keys.length > 3 ? ", ..." : ""}}`;
  }

  return String(value);
}

export async function recordTrace<T>(
  steps: TraceRef[],
  toolName: string,
  inputSummary: string,
  fn: () => Promise<T>,
): Promise<T> {
  const step = steps.length + 1;
  const timestamp = new Date().toISOString();
  const result = await fn();
  steps.push({
    step,
    tool: toolName,
    inputSummary,
    outputSummary: summarizeOutput(result),
    timestamp,
  });
  return result;
}
