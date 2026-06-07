import { useEffect, useRef, useState } from "react";
import type { StepState } from "../../schemas/events/index.js";

// Hold the "completing" UI for ~2s so the user perceives the transition rather
// than a flash. The extra 300ms when the report step has already completed
// lets its final tick render before the view swaps.
const REPORT_COMPLETE_DELAY_MS = 2300;
const DEFAULT_COMPLETE_DELAY_MS = 2000;

export interface UseReviewCompletionOptions {
  isStreaming: boolean;
  error: string | null;
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
  hasStreamed,
  steps,
  onComplete,
}: UseReviewCompletionOptions): UseReviewCompletionResult {
  const [isCompleting, setIsCompleting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevIsStreamingRef = useRef(false);
  const stepsRef = useRef(steps);
  const onCompleteRef = useRef(onComplete);
  // Stable-ref escape hatch: refs are read ONLY inside the effect, the timer
  // callback, and event handlers — never during render — so mid-render writes
  // are safe under concurrent rendering. See AGENTS.md react-useref rules.
  stepsRef.current = steps;
  onCompleteRef.current = onComplete;

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => {
    const wasStreaming = prevIsStreamingRef.current;
    prevIsStreamingRef.current = isStreaming;

    if (wasStreaming && !isStreaming && hasStreamed && !error) {
      setIsCompleting(true);

      const reportStep = stepsRef.current.find((s) => s.id === "report");
      const reportCompleted = reportStep?.status === "completed";
      const delayMs = reportCompleted ? REPORT_COMPLETE_DELAY_MS : DEFAULT_COMPLETE_DELAY_MS;

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setIsCompleting(false);
        onCompleteRef.current();
      }, delayMs);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isStreaming, error, hasStreamed]);

  function skipDelay() {
    clearTimer();
    setIsCompleting(false);
    onCompleteRef.current();
  }

  function reset() {
    clearTimer();
    prevIsStreamingRef.current = false;
    setIsCompleting(false);
  }

  return { isCompleting, skipDelay, reset };
}
