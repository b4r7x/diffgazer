import { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ReviewProgressView } from './review-progress-view';
import { ApiKeyMissingView } from './api-key-missing-view';
import { useTriageStream } from '../hooks/use-triage-stream';
import { useConfig } from '@/features/settings/hooks/use-config';
import { convertAgentEventsToLogEntries } from '@repo/core/review';
import type { ProgressStepData, ProgressStatus } from '@/components/ui';
import type { StepState } from '@repo/schemas/step-event';
import type { AgentState, AgentStatus } from '@repo/schemas/agent-event';
import type { ProgressSubstepData } from '@repo/schemas/ui';
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

function mapAgentToSubstepStatus(agentStatus: AgentStatus): ProgressSubstepData['status'] {
  switch (agentStatus) {
    case 'queued': return 'pending';
    case 'running': return 'active';
    case 'complete': return 'completed';
  }
}

function deriveSubstepsFromAgents(agents: AgentState[]): ProgressSubstepData[] {
  return agents.map(agent => ({
    id: agent.id,
    emoji: agent.meta.emoji,
    label: agent.meta.name,
    status: mapAgentToSubstepStatus(agent.status),
  }));
}

function mapStepsToProgressData(
  steps: StepState[],
  agents: AgentState[]
): ProgressStepData[] {
  return steps.map(step => {
    const substeps = step.id === 'triage' && agents.length > 0
      ? deriveSubstepsFromAgents(agents)
      : undefined;

    return {
      id: step.id,
      label: step.label,
      status: mapStepStatus(step.status),
      substeps,
    };
  });
}

/**
 * Container that manages the review flow:
 * 1. Shows ApiKeyMissingView if not configured
 * 2. Shows ReviewProgressView during triage
 * 3. Calls onComplete when done (parent can switch to results view)
 */
export function ReviewContainer({ mode, onComplete }: ReviewContainerProps) {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { reviewId?: string };
  const { isConfigured, isLoading: configLoading, provider } = useConfig();
  const { state, start, stop, resume } = useTriageStream();

  const startTimeRef = useRef<Date>(new Date());
  const hasStartedRef = useRef(false);
  const hasStreamedRef = useRef(false);
  const completeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (state.isStreaming) {
      hasStreamedRef.current = true;
    }
  }, [state.isStreaming]);

  useEffect(() => {
    if (state.reviewId && !params.reviewId) {
      navigate({
        to: '/review/$reviewId',
        params: { reviewId: state.reviewId },
        replace: true,
      });
    }
  }, [state.reviewId, params.reviewId, navigate]);

  useEffect(() => {
    if (hasStartedRef.current) return;
    if (configLoading) return;
    if (!isConfigured) return;
    hasStartedRef.current = true;

    const options = { staged: mode === 'staged' };

    if (params.reviewId) {
      // Try to resume existing session
      resume(params.reviewId).catch(() => {
        // Resume failed - start new review instead
        start(options);
      });
    } else {
      // Start new review
      start(options);
    }
  }, [mode, start, resume, configLoading, isConfigured, params.reviewId]);

  // Delay transition so users see final step completions before switching views
  useEffect(() => {
    if (!state.isStreaming && hasStreamedRef.current) {
      if (completeTimeoutRef.current) {
        clearTimeout(completeTimeoutRef.current);
      }
      completeTimeoutRef.current = setTimeout(() => {
        onComplete?.({ issues: state.issues, reviewId: state.reviewId, error: state.error });
      }, 400);
    }
    return () => {
      if (completeTimeoutRef.current) {
        clearTimeout(completeTimeoutRef.current);
      }
    };
  }, [state.isStreaming, state.issues, state.reviewId, state.error, onComplete]);

  const handleCancel = () => {
    stop();
    navigate({ to: '/' });
  };

  const handleViewResults = () => {
    if (completeTimeoutRef.current) {
      clearTimeout(completeTimeoutRef.current);
    }
    stop();
    onComplete?.({ issues: state.issues, reviewId: state.reviewId, error: state.error });
  };

  const handleSetupProvider = () => {
    stop();
    navigate({ to: '/settings/providers' });
  };

  const progressSteps = useMemo(
    () => mapStepsToProgressData(state.steps, state.agents),
    [state.steps, state.agents]
  );

  const logEntries = useMemo(
    () => convertAgentEventsToLogEntries(state.events),
    [state.events]
  );

  const metrics = useMemo(() => ({
    filesProcessed: state.fileProgress.completed.size,
    filesTotal: state.fileProgress.total || state.fileProgress.completed.size,
    issuesFound: state.issues.length,
    elapsed: 0,
  }), [state.fileProgress.completed.size, state.fileProgress.total, state.issues.length]);

  if (configLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-gray-500 font-mono text-sm" role="status" aria-live="polite">Loading...</div>
      </div>
    );
  }

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
