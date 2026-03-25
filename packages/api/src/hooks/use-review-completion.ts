import { useState, useEffect, useRef } from "react";
import type { StepState } from "@diffgazer/schemas/events";

const REPORT_COMPLETE_DELAY_MS = 2300;
const DEFAULT_COMPLETE_DELAY_MS = 400;

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
  stepsRef.current = steps;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const wasStreaming = prevIsStreamingRef.current;
    prevIsStreamingRef.current = isStreaming;

    if (wasStreaming && !isStreaming && hasStreamed && !error) {
      setIsCompleting(true);

      const reportStep = stepsRef.current.find((s) => s.id === "report");
      const reportCompleted = reportStep?.status === "completed";
      const delayMs = reportCompleted
        ? REPORT_COMPLETE_DELAY_MS
        : DEFAULT_COMPLETE_DELAY_MS;

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
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsCompleting(false);
    onCompleteRef.current();
  }

  function reset() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    prevIsStreamingRef.current = false;
    setIsCompleting(false);
  }

  return { isCompleting, skipDelay, reset };
}
