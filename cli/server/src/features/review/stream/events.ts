import { getErrorMessage } from "@diffgazer/core/errors";
import { looksLikeSerializedDiagnostic, sanitizePresentationText } from "@diffgazer/core/review";
import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import {
  type ReviewError,
  ReviewErrorCode,
  ReviewErrorSchema,
} from "@diffgazer/core/schemas/review";
import { ZodError } from "zod";
import { log } from "../../../shared/lib/log.js";
import { isReviewAbort } from "../abort.js";

export function isReviewStreamErrorCode(code: unknown): code is ReviewError["code"] {
  return ReviewErrorSchema.shape.code.safeParse(code).success;
}

const INTERNAL_ERROR_COPY =
  "Diffgazer hit an internal error while processing this review. This is a bug in Diffgazer, not a problem with your provider or configuration. The run could not be saved — retry the review, and report this if it happens again.";

const FIRST_ISSUE_MESSAGE_CAP = 200;

function isZodError(error: unknown): error is ZodError {
  if (error instanceof ZodError) return true;
  const candidate = error as { name?: unknown; issues?: unknown } | null;
  return candidate?.name === "ZodError" && Array.isArray(candidate.issues);
}

/**
 * The single boundary where an arbitrary exception message becomes a stream
 * error. Provider and transport exceptions routinely carry home paths, bearer
 * tokens, and correlation ids, so the message is sanitized here rather than in
 * each renderer — the SSE body is what both Web and the TUI display verbatim.
 */
export function normalizeReviewStreamError(
  error: unknown,
  fallbackCode: ReviewError["code"] = ReviewErrorCode.GENERATION_FAILED,
  context?: { reviewId?: string },
): ReviewError {
  const resolveCode = (code: unknown): ReviewError["code"] =>
    isReviewStreamErrorCode(code) ? code : fallbackCode;

  // A serialized JSON object/array is never an intentionally-emitted message —
  // it is a leaked diagnostic. Replace it, keep the caller's code, and log the
  // original so the diagnostic survives on the server side.
  const scrubSerialized = (message: string, code: ReviewError["code"]): ReviewError | null => {
    if (!looksLikeSerializedDiagnostic(message)) return null;
    log("error", "review_error_scrubbed", {
      reason: "serialized-message",
      code,
      reviewId: context?.reviewId,
      error,
    });
    return { code, message: INTERNAL_ERROR_COPY };
  };

  if (isReviewAbort(error)) {
    const code = resolveCode(error.code);
    return (
      scrubSerialized(error.message, code) ?? {
        code,
        message: sanitizePresentationText(error.message),
      }
    );
  }

  if (isZodError(error)) {
    log("error", "review_error_scrubbed", {
      reason: "zod",
      code: ReviewErrorCode.INTERNAL_ERROR,
      reviewId: context?.reviewId,
      error,
      issues: error.issues,
    });
    const firstIssue = sanitizePresentationText(
      (error.issues[0]?.message ?? "").slice(0, FIRST_ISSUE_MESSAGE_CAP),
    );
    return {
      code: ReviewErrorCode.INTERNAL_ERROR,
      message: `${INTERNAL_ERROR_COPY} Internal check failed: ${firstIssue}`,
    };
  }

  if (error && typeof error === "object") {
    const candidate = error as { code?: unknown; message?: unknown };
    const message =
      typeof candidate.message === "string" && candidate.message.length > 0
        ? candidate.message
        : getErrorMessage(error);
    // A leaked diagnostic with no code of its own is a Diffgazer bug; one that
    // carries a provider code keeps it, so the guidance names the real fix
    // instead of blaming Diffgazer for a rate limit or a refused credential.
    const candidateCode = isReviewStreamErrorCode(candidate.code) ? candidate.code : null;
    return (
      scrubSerialized(message, candidateCode ?? ReviewErrorCode.INTERNAL_ERROR) ?? {
        code: candidateCode ?? fallbackCode,
        message: sanitizePresentationText(message),
      }
    );
  }

  const message = getErrorMessage(error);
  return (
    scrubSerialized(message, ReviewErrorCode.INTERNAL_ERROR) ?? {
      code: fallbackCode,
      message: sanitizePresentationText(message),
    }
  );
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
