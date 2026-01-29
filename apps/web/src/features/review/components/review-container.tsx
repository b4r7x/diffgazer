import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ReviewProgressView } from './review-progress-view';
import { useMockTriage } from '../hooks/use-mock-triage';

export type ReviewMode = 'unstaged' | 'staged' | 'files';

export interface ReviewContainerProps {
  mode: ReviewMode;
  onComplete?: () => void;
}

/**
 * Container that manages the review flow:
 * 1. Shows ReviewProgressView during triage
 * 2. Calls onComplete when done (parent can switch to results view)
 */
export function ReviewContainer({ mode, onComplete }: ReviewContainerProps) {
  const navigate = useNavigate();
  const {
    steps,
    entries,
    metrics,
    isRunning,
    isComplete,
    startTime,
    stop,
  } = useMockTriage(true); // auto-start on mount

  // Notify parent when complete
  useEffect(() => {
    if (isComplete && onComplete) {
      onComplete();
    }
  }, [isComplete, onComplete]);

  const handleCancel = () => {
    stop();
    navigate({ to: '/' });
  };

  const handleViewResults = () => {
    // Force complete and trigger callback
    stop();
    onComplete?.();
  };

  return (
    <ReviewProgressView
      mode={mode}
      steps={steps}
      entries={entries}
      metrics={{
        filesProcessed: metrics.filesProcessed,
        filesTotal: metrics.filesTotal,
        issuesFound: metrics.issuesFound,
        elapsed: 0, // Timer component handles this via startTime
      }}
      isRunning={isRunning}
      startTime={startTime ?? undefined}
      onViewResults={handleViewResults}
      onCancel={handleCancel}
    />
  );
}
