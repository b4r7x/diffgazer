import { useEffect, useRef } from 'react';
import type { Result } from '@stargazer/core/result';
import type { StreamReviewError } from '@stargazer/api/review';
import { ReviewErrorCode } from '@stargazer/schemas/review';
import type { LensId } from '@stargazer/schemas/review';
import type { ReviewCompleteData } from './use-review-lifecycle';
import type { ReviewMode } from '@stargazer/schemas/review';

interface ActiveReviewSessionResult {
  session: { reviewId: string } | null;
}

interface UseReviewStartOptions {
  mode: ReviewMode;
  configLoading: boolean;
  settingsLoading: boolean;
  isConfigured: boolean;
  defaultLenses: LensId[];
  reviewId: string | undefined;
  start: (options: { mode?: ReviewMode; lenses?: LensId[] }) => Promise<void>;
  resume: (id: string) => Promise<Result<void, StreamReviewError>>;
  getActiveSession: (mode: ReviewMode) => Promise<ActiveReviewSessionResult>;
  onResumeFailed: (data: ReviewCompleteData) => void;
}

export function useReviewStart({
  mode,
  configLoading,
  settingsLoading,
  isConfigured,
  defaultLenses,
  reviewId,
  start,
  resume,
  getActiveSession,
  onResumeFailed,
}: UseReviewStartOptions) {
  const hasStartedRef = useRef(false);
  const hasStreamedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current) return;
    if (configLoading || settingsLoading || !isConfigured) return;
    hasStartedRef.current = true;
    hasStreamedRef.current = true;

    let ignore = false;

    const options = { mode, lenses: defaultLenses };
    const startFresh = () => {
      if (ignore) return;
      void start(options);
    };

    const handleResumeResult = (
      result: Result<void, StreamReviewError>,
      onNotFound: () => void,
    ) => {
      if (ignore) return;
      if (result.ok) return;

      if (result.error.code === ReviewErrorCode.SESSION_STALE) {
        startFresh();
        return;
      }

      if (result.error.code === ReviewErrorCode.SESSION_NOT_FOUND) {
        onNotFound();
        return;
      }
    };

    const resumeById = (id: string, onNotFound: () => void) => {
      resume(id)
        .then((result) => {
          handleResumeResult(result, onNotFound);
        })
        .catch(() => {
          // Transport/runtime errors — hook already set error state.
        });
    };

    if (reviewId) {
      resumeById(reviewId, () => {
        onResumeFailed({
          issues: [],
          reviewId: reviewId ?? null,
          resumeFailed: true,
        });
      });
    } else {
      getActiveSession(mode)
        .then((active) => {
          if (ignore) return;

          const activeReviewId = active.session?.reviewId;
          if (!activeReviewId) {
            startFresh();
            return;
          }

          resumeById(activeReviewId, startFresh);
        })
        .catch(() => {
          startFresh();
        });
    }

    return () => { ignore = true; };
  }, [
    mode,
    start,
    resume,
    getActiveSession,
    configLoading,
    isConfigured,
    reviewId,
    settingsLoading,
    defaultLenses,
    onResumeFailed,
  ]);

  return { hasStartedRef, hasStreamedRef };
}
