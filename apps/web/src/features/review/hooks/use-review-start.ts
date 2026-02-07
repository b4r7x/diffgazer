import { useEffect, useRef } from 'react';
import type { Result } from '@stargazer/core/result';
import type { StreamReviewError } from '@stargazer/api/review';
import { ReviewErrorCode } from '@stargazer/schemas/review';
import type { LensId } from '@stargazer/schemas/review';
import type { ReviewCompleteData } from './use-review-lifecycle';
import type { ReviewMode } from '@stargazer/schemas/review';

interface UseReviewStartOptions {
  mode: ReviewMode;
  configLoading: boolean;
  settingsLoading: boolean;
  isConfigured: boolean;
  defaultLenses: LensId[];
  reviewId: string | undefined;
  start: (options: { mode?: ReviewMode; lenses?: LensId[] }) => Promise<void>;
  resume: (id: string) => Promise<Result<void, StreamReviewError>>;
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

    if (reviewId) {
      resume(reviewId)
        .then((result) => {
          if (ignore) return;
          if (result.ok) return;

          if (result.error.code === ReviewErrorCode.SESSION_STALE) {
            start(options);
            return;
          }

          if (result.error.code === ReviewErrorCode.SESSION_NOT_FOUND) {
            onResumeFailed({
              issues: [],
              reviewId: reviewId ?? null,
              resumeFailed: true,
            });
          }
        })
        .catch(() => {
          // Transport/runtime errors — hook already set error state.
        });
    } else {
      if (!ignore) start(options);
    }

    return () => { ignore = true; };
  }, [mode, start, resume, configLoading, isConfigured, reviewId, settingsLoading, defaultLenses]);

  return { hasStartedRef, hasStreamedRef };
}
