import { useEffect, useEffectEvent, useState } from "react";
import type { Result } from "../../result.js";
import { isSessionTerminationCode, type SessionTerminationCode } from "../../review/lifecycle.js";
import type { StreamReviewError } from "../../review/stream.js";
import { ReviewErrorCode } from "../../schemas/review/index.js";

export interface UseReviewStartOptions {
  configLoading: boolean;
  settingsLoading: boolean;
  isConfigured: boolean;
  allowResumeWithoutSetup?: boolean;
  reviewId?: string;
  currentReviewId?: string | null;
  resume: (id: string) => Promise<Result<void, StreamReviewError>>;
  onNotFoundInSession?: (reviewId: string) => void;
  onStaleSession?: (code: SessionTerminationCode) => void;
}

/**
 * `idle` — no resume attempted yet. `streaming` — a resume ran, so the stream
 * history belongs to this mount. `terminated` — the resume hit a stale or
 * missing session, so there is no usable history to complete from.
 */
type ReviewStartStatus = "idle" | "streaming" | "terminated";

export interface UseReviewStartResult {
  status: ReviewStartStatus;
  reset: () => void;
}

export function useReviewStart(options: UseReviewStartOptions): UseReviewStartResult {
  const [status, setStatus] = useState<ReviewStartStatus>("idle");

  const getCurrentReviewId = useEffectEvent(() => options.currentReviewId);
  const resumeReview = useEffectEvent((reviewId: string) => options.resume(reviewId));
  const handleResumeError = useEffectEvent((reviewId: string, error: StreamReviewError) => {
    if (isSessionTerminationCode(error.code)) {
      options.onStaleSession?.(error.code);
    } else if (error.code === ReviewErrorCode.SESSION_NOT_FOUND) {
      options.onNotFoundInSession?.(reviewId);
    }
  });

  useEffect(() => {
    const canResume = options.isConfigured || options.allowResumeWithoutSetup;
    if (options.configLoading || options.settingsLoading || !canResume) return;

    const reviewId = options.reviewId;
    if (!reviewId) return;

    if (getCurrentReviewId() === reviewId) return;

    let ignore = false;

    setStatus("streaming");

    void resumeReview(reviewId).then((result) => {
      if (ignore) return;
      if (result.ok) return;

      if (
        isSessionTerminationCode(result.error.code) ||
        result.error.code === ReviewErrorCode.SESSION_NOT_FOUND
      ) {
        setStatus("terminated");
      }
      handleResumeError(reviewId, result.error);
    });

    return () => {
      ignore = true;
    };
  }, [
    options.configLoading,
    options.settingsLoading,
    options.isConfigured,
    options.allowResumeWithoutSetup,
    options.reviewId,
  ]);

  return { status, reset: () => setStatus("idle") };
}
