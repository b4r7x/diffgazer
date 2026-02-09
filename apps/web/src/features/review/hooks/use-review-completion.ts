import { useEffect, useRef } from 'react';
import type { ReviewIssue } from '@diffgazer/schemas/review';
import type { StepState } from '@diffgazer/schemas/events';

const REPORT_COMPLETE_DELAY_MS = 2300;
const DEFAULT_COMPLETE_DELAY_MS = 400;

interface UseReviewCompletionOptions {
  isStreaming: boolean;
  error: string | null;
  hasStreamed: boolean;
  steps: StepState[];
  issues: ReviewIssue[];
  reviewId: string | null;
  onComplete: (data: { issues: ReviewIssue[]; reviewId: string | null }) => void;
}

export function useReviewCompletion({
  isStreaming,
  error,
  hasStreamed,
  steps,
  issues,
  reviewId,
  onComplete,
}: UseReviewCompletionOptions) {
  const completeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevIsStreamingRef = useRef(isStreaming);

  // Snapshot refs so the timeout callback reads current values
  const stepsRef = useRef(steps);
  const issuesRef = useRef(issues);
  const reviewIdRef = useRef(reviewId);
  stepsRef.current = steps;
  issuesRef.current = issues;
  reviewIdRef.current = reviewId;

  useEffect(() => {
    const wasStreaming = prevIsStreamingRef.current;
    prevIsStreamingRef.current = isStreaming;

    if (wasStreaming && !isStreaming && hasStreamed && !error) {
      if (completeTimeoutRef.current) {
        clearTimeout(completeTimeoutRef.current);
      }

      const reportStep = stepsRef.current.find(s => s.id === 'report');
      const reportCompleted = reportStep?.status === 'completed';
      const delayMs = reportCompleted ? REPORT_COMPLETE_DELAY_MS : DEFAULT_COMPLETE_DELAY_MS;

      completeTimeoutRef.current = setTimeout(() => {
        onComplete({ issues: issuesRef.current, reviewId: reviewIdRef.current });
      }, delayMs);
    }
    return () => {
      if (completeTimeoutRef.current) {
        clearTimeout(completeTimeoutRef.current);
      }
    };
  }, [isStreaming, error]);

  const skipDelayAndComplete = () => {
    if (completeTimeoutRef.current) {
      clearTimeout(completeTimeoutRef.current);
    }
    onComplete({ issues: issuesRef.current, reviewId: reviewIdRef.current });
  };

  return { skipDelayAndComplete };
}
