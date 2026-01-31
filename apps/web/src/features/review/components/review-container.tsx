import { useEffect, useRef, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ReviewProgressView } from './review-progress-view';
import { useTriageStream } from '../hooks/use-triage-stream';
import type { ProgressStepData, ProgressStatus } from '@/components/ui';
import type { StepState } from '@repo/schemas/step-event';
import type { ReviewMode } from '../types';

export interface ReviewContainerProps {
  mode: ReviewMode;
  onComplete?: () => void;
}

/** Map StepState status to ProgressStatus (UI doesn't have "error") */
function mapStepStatus(status: StepState['status']): ProgressStatus {
  if (status === 'error') return 'pending';
  return status;
}

/** Convert StepState[] to ProgressStepData[] */
function mapStepsToProgressData(steps: StepState[]): ProgressStepData[] {
  return steps.map(step => ({
    id: step.id,
    label: step.label,
    status: mapStepStatus(step.status),
  }));
}

/**
 * Container that manages the review flow:
 * 1. Shows ReviewProgressView during triage
 * 2. Calls onComplete when done (parent can switch to results view)
 */
export function ReviewContainer({ mode, onComplete }: ReviewContainerProps) {
  const navigate = useNavigate();
  const { state, start, stop } = useTriageStream();
  const startTimeRef = useRef<Date | null>(null);
  const hasStartedRef = useRef(false);

  // Auto-start on mount
  useEffect(() => {
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      startTimeRef.current = new Date();
      // Convert mode to StreamTriageRequest format
      start({ staged: mode === 'staged' });
    }
  }, [mode, start]);

  // Notify parent when complete
  useEffect(() => {
    if (!state.isStreaming && state.issues.length > 0 && onComplete) {
      onComplete();
    }
  }, [state.isStreaming, state.issues.length, onComplete]);

  // Map steps from backend state to UI format
  const progressSteps = useMemo(
    () => mapStepsToProgressData(state.steps),
    [state.steps]
  );

  const handleCancel = () => {
    stop();
    navigate({ to: '/' });
  };

  const handleViewResults = () => {
    stop();
    onComplete?.();
  };

  return (
    <ReviewProgressView
      mode={mode}
      steps={progressSteps}
      entries={[]} // TODO: wire up activity log from agent events
      metrics={{
        filesProcessed: state.agents.filter(a => a.status === 'complete').length,
        filesTotal: state.agents.length || 1,
        issuesFound: state.issues.length,
        elapsed: 0,
      }}
      isRunning={state.isStreaming}
      startTime={startTimeRef.current ?? undefined}
      onViewResults={handleViewResults}
      onCancel={handleCancel}
    />
  );
}
