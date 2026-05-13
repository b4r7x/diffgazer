import { useState, useEffect, useRef } from "react";
import type { Result } from "@diffgazer/core/result";
import type { StreamReviewError } from "@diffgazer/core/review";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import type { LensId, ReviewMode } from "@diffgazer/core/schemas/review";

interface ActiveReviewSessionResult {
  session: { reviewId: string } | null;
}

export interface UseReviewStartOptions {
  mode: ReviewMode;
  configLoading: boolean;
  settingsLoading: boolean;
  isConfigured: boolean;
  defaultLenses: LensId[];
  reviewId?: string;
  startToken?: number;
  start: (options: { mode?: ReviewMode; lenses?: LensId[] }) => Promise<void>;
  resume: (id: string) => Promise<Result<void, StreamReviewError>>;
  getActiveSession: (mode: ReviewMode) => Promise<ActiveReviewSessionResult>;
  onNotFoundInSession?: (reviewId: string) => void;
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

  const startRef = useRef(options.start);
  const resumeRef = useRef(options.resume);
  const getActiveSessionRef = useRef(options.getActiveSession);
  const defaultLensesRef = useRef(options.defaultLenses);
  const onNotFoundRef = useRef(options.onNotFoundInSession);
  startRef.current = options.start;
  resumeRef.current = options.resume;
  getActiveSessionRef.current = options.getActiveSession;
  defaultLensesRef.current = options.defaultLenses;
  onNotFoundRef.current = options.onNotFoundInSession;

  useEffect(() => {
    if (options.configLoading || options.settingsLoading || !options.isConfigured) return;

    let ignore = false;

    const startOptions = { mode: options.mode, lenses: defaultLensesRef.current };
    const markStarted = () => {
      setHasStarted(true);
      setHasStreamed(true);
    };
    const startFresh = () => {
      if (ignore) return;
      markStarted();
      void startRef.current(startOptions);
    };

    const handleResumeResult = (
      result: Result<void, StreamReviewError>,
      resumedId: string,
      fromActiveSession: boolean,
    ) => {
      if (ignore) return;
      if (result.ok) return;

      if (result.error.code === ReviewErrorCode.SESSION_STALE) {
        startFresh();
      } else if (result.error.code === ReviewErrorCode.SESSION_NOT_FOUND) {
        if (fromActiveSession) {
          startFresh();
        } else {
          onNotFoundRef.current?.(resumedId);
        }
      }
    };

    const resumeReview = (reviewId: string, fromActiveSession: boolean) => {
      if (ignore) return;
      markStarted();
      void resumeRef.current(reviewId).then((result) => {
        handleResumeResult(result, reviewId, fromActiveSession);
      });
    };

    if (options.reviewId) {
      resumeReview(options.reviewId, false);
    } else {
      void getActiveSessionRef.current(options.mode)
        .then((active) => {
          if (ignore) return;
          const activeReviewId = active.session?.reviewId;
          if (!activeReviewId) {
            startFresh();
            return;
          }
          resumeReview(activeReviewId, true);
        })
        .catch(() => {
          startFresh();
        });
    }

    return () => { ignore = true; };
  }, [
    options.mode,
    options.configLoading,
    options.settingsLoading,
    options.isConfigured,
    options.reviewId,
    options.startToken,
  ]);

  return { hasStarted, hasStreamed, setHasStarted, setHasStreamed };
}
