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
  // State for external consumers (reactive, triggers re-renders)
  const [hasStarted, setHasStarted] = useState(false);
  const [hasStreamed, setHasStreamed] = useState(false);

  // Ref for the effect guard — prevents the effect from self-cancelling
  // when setHasStarted(true) triggers a re-render.
  // The state value is for consumers; the ref is for the effect's own guard.
  const hasStartedGuard = useRef(false);

  // Stable refs for callbacks and arrays
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

  // Sync external setHasStarted(false) back to the guard ref
  // so that startToken re-triggers work
  if (!hasStarted) {
    hasStartedGuard.current = false;
  }

  useEffect(() => {
    if (hasStartedGuard.current) return;
    if (options.configLoading || options.settingsLoading || !options.isConfigured) return;

    // Mark started synchronously via ref (no re-render, no cleanup race)
    hasStartedGuard.current = true;
    setHasStarted(true);
    setHasStreamed(true);

    let ignore = false;

    const startOptions = { mode: options.mode, lenses: defaultLensesRef.current };
    const startFresh = () => {
      if (ignore) return;
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

    if (options.reviewId) {
      void resumeRef.current(options.reviewId).then((result) => {
        handleResumeResult(result, options.reviewId!, false);
      });
    } else {
      void getActiveSessionRef.current(options.mode)
        .then((active) => {
          if (ignore) return;
          const activeReviewId = active.session?.reviewId;
          if (!activeReviewId) {
            startFresh();
            return;
          }
          void resumeRef.current(activeReviewId).then((result) => {
            handleResumeResult(result, activeReviewId, true);
          });
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
