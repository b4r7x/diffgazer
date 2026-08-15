import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { ReviewStateErrorCode } from "../../review/state.js";
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
  errorCode: ReviewStateErrorCode | null;
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

// `handled` is a completion the caller has already taken delivery of (reset). It is distinct from
// `idle` because the stream is still sitting on its completion signal, and re-arming from those
// same props would restart the delay the caller just dismissed.
type CompletionState =
  | { status: "idle" }
  | { status: "handled" }
  | { status: "delaying" | "completed"; completedAt: Date };

type TimerRef = { current: ReturnType<typeof setTimeout> | null };

function clearTimer(timerRef: TimerRef) {
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

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
  const getCompletionDelay = useEffectEvent(() => {
    const reportStep = steps.find((s) => s.id === "report");
    return reportStep?.status === "completed"
      ? REPORT_COMPLETE_DELAY_MS
      : DEFAULT_COMPLETE_DELAY_MS;
  });
  const emitComplete = useEffectEvent(onComplete);
  const emitStreamComplete = useEffectEvent(() => onStreamComplete?.());

  useEffect(() => {
    return () => {
      clearTimer(timerRef);
    };
  }, []);

  useEffect(() => {
    const canComplete =
      !isStreaming &&
      hasStreamed &&
      isComplete &&
      !error &&
      errorCode !== ReviewErrorCode.CANCELLED;

    if (canComplete && completion.status === "idle") {
      setCompletion({ status: "delaying", completedAt: new Date() });
      emitStreamComplete();
      const delayMs = getCompletionDelay();

      clearTimer(timerRef);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setCompletion((current) =>
          current.status === "delaying" ? { ...current, status: "completed" } : current,
        );
        emitComplete();
      }, delayMs);
      return;
    }

    // Also runs once the delay has elapsed, so a run that restarts without `reset` cannot keep
    // reporting the previous run's completedAt.
    if (
      completion.status !== "idle" &&
      (isStreaming ||
        !isComplete ||
        error ||
        errorCode === ReviewErrorCode.CANCELLED ||
        !hasStreamed)
    ) {
      clearTimer(timerRef);
      setCompletion({ status: "idle" });
    }
  }, [isStreaming, isComplete, error, errorCode, hasStreamed, completion.status]);

  function skipDelay() {
    // Only a running completion delay can be skipped. Before the stream ends
    // there is no deduped result and no duration to hand over, so an early call
    // must emit nothing rather than complete the review with partial data.
    if (completion.status !== "delaying") return;
    clearTimer(timerRef);
    setCompletion({ status: "completed", completedAt: completion.completedAt });
    onComplete();
  }

  function reset() {
    clearTimer(timerRef);
    setCompletion({ status: "handled" });
  }

  return {
    isCompleting: completion.status === "delaying",
    completedAt:
      completion.status === "idle" || completion.status === "handled"
        ? null
        : completion.completedAt,
    skipDelay,
    reset,
  };
}
