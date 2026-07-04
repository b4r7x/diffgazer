import { useEffect, useEffectEvent, useState } from "react";
import type { Result } from "../../result.js";
import {
  isSessionTerminationCode,
  type SessionTerminationCode,
  type StreamReviewError,
} from "../../review/index.js";
import { ReviewErrorCode } from "../../schemas/review/index.js";

export interface UseReviewStartOptions {
  configLoading: boolean;
  settingsLoading: boolean;
  isConfigured: boolean;
  reviewId?: string;
  currentReviewId?: string | null;
  resume: (id: string) => Promise<Result<void, StreamReviewError>>;
  onNotFoundInSession?: (reviewId: string) => void;
  onStaleSession?: (code: SessionTerminationCode) => void;
}

export interface UseReviewStartResult {
  hasStarted: boolean;
  hasStreamed: boolean;
  setHasStarted: (value: boolean) => void;
  setHasStreamed: (value: boolean) => void;
}

export function useReviewStart(options: UseReviewStartOptions): UseReviewStartResult {
  const [hasStarted, setHasStarted] = useState(false);
  const [hasStreamed, setHasStreamed] = useState(false);

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
    if (options.configLoading || options.settingsLoading || !options.isConfigured) return;

    const reviewId = options.reviewId;
    if (!reviewId) return;

    if (getCurrentReviewId() === reviewId) return;

    let ignore = false;

    setHasStarted(true);
    setHasStreamed(true);

    void resumeReview(reviewId).then((result) => {
      if (ignore) return;
      if (result.ok) return;

      handleResumeError(reviewId, result.error);
    });

    return () => {
      ignore = true;
    };
  }, [options.configLoading, options.settingsLoading, options.isConfigured, options.reviewId]);

  return { hasStarted, hasStreamed, setHasStarted, setHasStreamed };
}
