import { useEffect, useRef } from 'react';
import type { Result } from '@diffgazer/core/result';
import type { StreamReviewError } from '@diffgazer/api/review';
import { ReviewErrorCode } from '@diffgazer/schemas/review';
import type { LensId } from '@diffgazer/schemas/review';

import type { ReviewMode } from '@diffgazer/schemas/review';

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
  onNotFoundInSession: (reviewId: string) => void;
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
  onNotFoundInSession,
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

    const resumeById = (id: string, onNotFound: () => void) => {
      void resume(id).then((result) => {
        if (ignore || result.ok) return;

        if (result.error.code === ReviewErrorCode.SESSION_STALE) {
          startFresh();
        } else if (result.error.code === ReviewErrorCode.SESSION_NOT_FOUND) {
          onNotFound();
        }
      });
    };

    if (reviewId) {
      resumeById(reviewId, () => {
        onNotFoundInSession(reviewId);
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
  ]);

  return { hasStartedRef, hasStreamedRef };
}
