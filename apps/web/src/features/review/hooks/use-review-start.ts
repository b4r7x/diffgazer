import { useEffect, useRef } from 'react';
import type { LensId, ReviewMode } from '@diffgazer/schemas/review';
import { ReviewErrorCode } from '@diffgazer/schemas/review';
import type { Result } from '@diffgazer/core/result';
import type { StreamReviewError } from '@diffgazer/api/hooks';

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

    if (reviewId) {
      void resume(reviewId).then((result) => {
        if (!result.ok && (result.error.code === ReviewErrorCode.SESSION_STALE || result.error.code === ReviewErrorCode.SESSION_NOT_FOUND)) {
          startFresh();
        }
      });
    } else {
      void getActiveSession(mode)
        .then((active) => {
          if (ignore) return;

          const activeReviewId = active.session?.reviewId;
          if (!activeReviewId) {
            startFresh();
            return;
          }

          void resume(activeReviewId).then((result) => {
            if (!result.ok && (result.error.code === ReviewErrorCode.SESSION_STALE || result.error.code === ReviewErrorCode.SESSION_NOT_FOUND)) {
              startFresh();
            }
          });
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
  ]);

  return { hasStartedRef, hasStreamedRef };
}
