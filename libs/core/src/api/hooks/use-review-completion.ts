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
  isComplete: boolean;
  error: string | null;
  errorCode: string | null;
  hasStreamed: boolean;
  steps: StepState[];
  onComplete: () => void;
  onStreamComplete?: () => void;
}

export interface UseReviewCompletionResult {
  isCompleting: boolean;
  completedAt: Date | null;
  skipDelay: () => void;
  reset: () => void;
}

type CompletionState = { status: "idle" } | { status: "delaying" | "completed"; completedAt: Date };

export function useReviewCompletion({
  isStreaming,
  isComplete,
  error,
  errorCode,
  hasStreamed,
  steps,
  onComplete,
  onStreamComplete,
}: UseReviewCompletionOptions): UseReviewCompletionResult {
  const [completion, setCompletion] = useState<CompletionState>({ status: "idle" });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handledCompletionRef = useRef(false);
  const getCompletionDelay = useEffectEvent(() => {
    const reportStep = steps.find((s) => s.id === "report");
    return reportStep?.status === "completed"
      ? REPORT_COMPLETE_DELAY_MS
      : DEFAULT_COMPLETE_DELAY_MS;
  });
  const emitComplete = useEffectEvent(onComplete);
  const emitStreamComplete = useEffectEvent(() => onStreamComplete?.());

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const canComplete =
      !isStreaming &&
      hasStreamed &&
      isComplete &&
      !error &&
      errorCode !== ReviewErrorCode.CANCELLED;

    if (canComplete && !handledCompletionRef.current) {
      handledCompletionRef.current = true;
      setCompletion({ status: "delaying", completedAt: new Date() });
      emitStreamComplete();
      const delayMs = getCompletionDelay();

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setCompletion((current) =>
          current.status === "delaying" ? { ...current, status: "completed" } : current,
        );
        emitComplete();
      }, delayMs);
      return;
    }

    if (!isComplete || !hasStreamed) {
      handledCompletionRef.current = false;
    }

    if (
      timerRef.current &&
      (isStreaming ||
        !isComplete ||
        error ||
        errorCode === ReviewErrorCode.CANCELLED ||
        !hasStreamed)
    ) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      setCompletion({ status: "idle" });
    }
  }, [isStreaming, isComplete, error, errorCode, hasStreamed]);

  function skipDelay() {
    clearTimer();
    setCompletion((current) =>
      current.status === "delaying" ? { ...current, status: "completed" } : current,
    );
    onComplete();
  }

  function reset() {
    clearTimer();
    handledCompletionRef.current = false;
    setCompletion({ status: "idle" });
  }

  return {
    isCompleting: completion.status === "delaying",
    completedAt: completion.status === "idle" ? null : completion.completedAt,
    skipDelay,
    reset,
  };
}
