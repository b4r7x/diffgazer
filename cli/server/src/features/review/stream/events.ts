import { getErrorMessage } from "@diffgazer/core/errors";
import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import {
  type ReviewError,
  ReviewErrorCode,
  ReviewErrorSchema,
} from "@diffgazer/core/schemas/review";
import { isReviewAbort } from "../abort.js";

export function isReviewStreamErrorCode(code: unknown): code is ReviewError["code"] {
  return ReviewErrorSchema.shape.code.safeParse(code).success;
}

export function normalizeReviewStreamError(
  error: unknown,
  fallbackCode: ReviewError["code"] = ReviewErrorCode.GENERATION_FAILED,
): ReviewError {
  const resolveCode = (code: unknown): ReviewError["code"] =>
    isReviewStreamErrorCode(code) ? code : fallbackCode;

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
  code: ReviewError["code"] = ReviewErrorCode.GENERATION_FAILED,
): FullReviewStreamEvent {
  // `code` is the typed review-error union (abort codes and normalized codes are
  // both already in-union), so an out-of-union code is a compile error here — no
  // silent collapse. Untrusted input is narrowed earlier by normalizeReviewStreamError.
  return {
    type: "error",
    error: { code, message },
  };
}

export function isTerminalEvent(event: FullReviewStreamEvent): boolean {
  return event.type === "complete" || event.type === "error";
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
