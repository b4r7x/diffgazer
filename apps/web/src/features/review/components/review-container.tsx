import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ReviewProgressView } from './review-progress-view';
import { ApiKeyMissingView } from './api-key-missing-view';
import { useTriageStream } from '../hooks/use-triage-stream';
import { useConfig } from '@/features/settings/hooks/use-config';
import { convertAgentEventsToLogEntries } from '@repo/core/review';
import type { ProgressStepData, ProgressStatus } from '@/components/ui';
import type { StepState } from '@repo/schemas/step-event';
import type { ReviewMode } from '../types';
import type { TriageIssue } from '@repo/schemas';

export interface ReviewCompleteData {
  issues: TriageIssue[];
  reviewId: string | null;
  error: string | null;
}

export interface ReviewContainerProps {
  mode: ReviewMode;
  onComplete?: (data: ReviewCompleteData) => void;
}

function mapStepStatus(status: StepState['status']): ProgressStatus {
  return status === 'error' ? 'pending' : status;
}

function mapStepsToProgressData(steps: StepState[]): ProgressStepData[] {
  return steps.map(step => ({
    id: step.id,
    label: step.label,
    status: mapStepStatus(step.status),
  }));
}

/**
 * Container that manages the review flow:
 * 1. Shows ApiKeyMissingView if not configured
 * 2. Shows ReviewProgressView during triage
 * 3. Calls onComplete when done (parent can switch to results view)
 */
export function ReviewContainer({ mode, onComplete }: ReviewContainerProps) {
  const navigate = useNavigate();
  const { isConfigured, isLoading: configLoading, provider } = useConfig();
  const { state, start, stop } = useTriageStream();
  const startTimeRef = useRef<Date>(new Date());
  const hasStartedRef = useRef(false);
  const hasStreamedRef = useRef(false);

  // Track when streaming actually starts
  useEffect(() => {
    if (state.isStreaming) {
      hasStreamedRef.current = true;
    }
  }, [state.isStreaming]);

  // Auto-start on mount (only if configured)
  useEffect(() => {
    if (hasStartedRef.current) return;
    if (configLoading) return;
    if (!isConfigured) return;
    hasStartedRef.current = true;
    start({ staged: mode === 'staged' });
  }, [mode, start, configLoading, isConfigured]);

  // Notify parent when streaming completes (only after streaming has actually occurred)
  useEffect(() => {
    if (!state.isStreaming && hasStreamedRef.current) {
      onComplete?.({ issues: state.issues, reviewId: state.reviewId, error: state.error });
    }
  }, [state.isStreaming, state.issues, state.reviewId, state.error, onComplete]);

  const handleCancel = () => {
    stop();
    navigate({ to: '/' });
  };

  const handleViewResults = () => {
    stop();
    onComplete?.({ issues: state.issues, reviewId: state.reviewId, error: state.error });
  };

  const handleSetupProvider = () => {
    stop();
    navigate({ to: '/settings/providers' });
  };

  const progressSteps = useMemo(
    () => mapStepsToProgressData(state.steps),
    [state.steps]
  );

  const logEntries = useMemo(
    () => convertAgentEventsToLogEntries(state.events),
    [state.events]
  );

  const metrics = useMemo(() => ({
    filesProcessed: state.fileProgress.processed.size,
    filesTotal: state.fileProgress.total || state.fileProgress.processed.size || 1,
    issuesFound: state.issues.length,
    elapsed: 0,
  }), [state.fileProgress.processed.size, state.fileProgress.total, state.issues.length]);

  // Show loading state while checking config
  if (configLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-gray-500 font-mono text-sm" role="status" aria-live="polite">Loading...</div>
      </div>
    );
  }

  // Show API key missing view if not configured
  if (!isConfigured) {
    return (
      <ApiKeyMissingView
        activeProvider={provider}
        onNavigateSettings={handleSetupProvider}
        onBack={handleCancel}
      />
    );
  }

  return (
    <ReviewProgressView
      mode={mode}
      steps={progressSteps}
      entries={logEntries}
      metrics={metrics}
      isRunning={state.isStreaming}
      error={state.error}
      startTime={startTimeRef.current}
      onViewResults={handleViewResults}
      onCancel={handleCancel}
    />
  );
}
