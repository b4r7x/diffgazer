import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { StepState } from "../../schemas/events/index.js";
import { ReviewErrorCode } from "../../schemas/review/index.js";

// Hold the "completing" UI for ~2s so the user perceives the transition rather
// than a flash. The extra 300ms when the report step has already completed
// lets its final tick render before the view swaps.
const REPORT_COMPLETE_DELAY_MS = 2300;
const DEFAULT_COMPLETE_DELAY_MS = 2000;

export interface UseReviewCompletionOptions {
  isStreaming: boolean;
  error: string | null;
  errorCode: string | null;
  hasStreamed: boolean;
  steps: StepState[];
  onComplete: () => void;
}

export interface UseReviewCompletionResult {
  isCompleting: boolean;
  skipDelay: () => void;
  reset: () => void;
}

export function useReviewCompletion({
  isStreaming,
  error,
  errorCode,
  hasStreamed,
  steps,
  onComplete,
}: UseReviewCompletionOptions): UseReviewCompletionResult {
  const [isCompleting, setIsCompleting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevIsStreamingRef = useRef(false);
  const getCompletionDelay = useEffectEvent(() => {
    const reportStep = steps.find((s) => s.id === "report");
    return reportStep?.status === "completed"
      ? REPORT_COMPLETE_DELAY_MS
      : DEFAULT_COMPLETE_DELAY_MS;
  });
  const emitComplete = useEffectEvent(onComplete);

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => {
    const wasStreaming = prevIsStreamingRef.current;
    prevIsStreamingRef.current = isStreaming;

    if (
      wasStreaming &&
      !isStreaming &&
      hasStreamed &&
      !error &&
      errorCode !== ReviewErrorCode.CANCELLED
    ) {
      setIsCompleting(true);
      const delayMs = getCompletionDelay();

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setIsCompleting(false);
        emitComplete();
      }, delayMs);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isStreaming, error, errorCode, hasStreamed]);

  function skipDelay() {
    clearTimer();
    setIsCompleting(false);
    emitComplete();
  }

  function reset() {
    clearTimer();
    prevIsStreamingRef.current = false;
    setIsCompleting(false);
  }

  return { isCompleting, skipDelay, reset };
}
