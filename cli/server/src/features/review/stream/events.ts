import { getErrorMessage } from "@diffgazer/core/errors";
import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import {
  ReviewErrorCode,
  type ReviewErrorCode as ReviewErrorCodeType,
} from "@diffgazer/core/schemas/review";
import { isReviewAbort } from "../abort.js";

const REVIEW_STREAM_ERROR_CODES = new Set(Object.values(ReviewErrorCode));

export function isReviewStreamErrorCode(
  code: string,
): code is (typeof ReviewErrorCode)[keyof typeof ReviewErrorCode] {
  return REVIEW_STREAM_ERROR_CODES.has(
    code as (typeof ReviewErrorCode)[keyof typeof ReviewErrorCode],
  );
}

export function normalizeReviewStreamError(
  error: unknown,
  fallbackCode: ReviewErrorCodeType = ReviewErrorCode.GENERATION_FAILED,
): { code: ReviewErrorCodeType; message: string } {
  const resolveCode = (code: unknown): ReviewErrorCodeType =>
    typeof code === "string" && isReviewStreamErrorCode(code) ? code : fallbackCode;

  if (isReviewAbort(error)) {
    return { code: resolveCode(error.code), message: error.message };
  }

  if (error && typeof error === "object") {
    const candidate = error as { code?: unknown; message?: unknown };
    return {
      code: resolveCode(candidate.code),
      message:
        typeof candidate.message === "string" && candidate.message.length > 0
          ? candidate.message
          : getErrorMessage(error),
    };
  }

  return { code: fallbackCode, message: getErrorMessage(error) };
}

export function reviewStreamError(
  message: string,
  code: unknown = ReviewErrorCode.GENERATION_FAILED,
): FullReviewStreamEvent {
  return {
    type: "error",
    error: {
      code:
        typeof code === "string" && isReviewStreamErrorCode(code)
          ? code
          : ReviewErrorCode.GENERATION_FAILED,
      message,
    },
  };
}

export function isTerminalEvent(event: FullReviewStreamEvent): boolean {
  return event.type === "complete" || event.type === "error";
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
