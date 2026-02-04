import { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ReviewProgressView } from './review-progress-view';
import { ApiKeyMissingView } from './api-key-missing-view';
import { NoChangesView } from './no-changes-view';
import { useTriageStream } from '../hooks/use-triage-stream';
import { useConfig } from '@/features/settings/hooks/use-config';
import { convertAgentEventsToLogEntries } from '@stargazer/core/review';
import type { ProgressStepData, ProgressStatus } from '@/components/ui';
import type { StepState } from '@stargazer/schemas/step-event';
import type { AgentState, AgentStatus } from '@stargazer/schemas/agent-event';
import type { ProgressSubstepData } from '@stargazer/schemas/ui';
import type { ReviewMode } from '../types';
import type { TriageIssue } from '@stargazer/schemas';

export interface ReviewCompleteData {
  issues: TriageIssue[];
  reviewId: string | null;
  resumeFailed?: boolean;
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

  const hasStartedRef = useRef(false);
  const hasStreamedRef = useRef(false);
  const completeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    if (state.isStreaming) {
      hasStreamedRef.current = true;
    }
  }, [state.isStreaming]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (state.reviewId && !params.reviewId) {
      navigate({
        to: '/review/$reviewId',
        params: { reviewId: state.reviewId },
        search: (prev: Record<string, unknown>) => prev, // Preserve query params (mode)
        replace: true,
      });
    }
  }, [state.reviewId, params.reviewId, navigate]);

  // Router's beforeLoad already validates UUID format, so we can trust params.reviewId
  useEffect(() => {
    if (hasStartedRef.current) return;
    if (configLoading) return;
    if (!isConfigured) return;
    hasStartedRef.current = true;

    const options = { mode };

    if (params.reviewId) {
      // Try to resume existing session
      resume(params.reviewId).catch(() => {
        // Resume failed - signal to parent to try loading from storage
        onCompleteRef.current?.({
          issues: [],
          reviewId: params.reviewId ?? null,
          resumeFailed: true
        });
      });
    } else {
      // Start new review
      start(options);
    }
  }, [mode, start, resume, configLoading, isConfigured, params.reviewId]);

  // Delay transition so users see final step completions before switching views
  useEffect(() => {
    if (!state.isStreaming && hasStreamedRef.current && !state.error) {
      if (completeTimeoutRef.current) {
        clearTimeout(completeTimeoutRef.current);
      }

      // Check if report step completed - add extra delay for this phase
      const reportStep = state.steps.find(s => s.id === 'report');
      const reportCompleted = reportStep?.status === 'completed';
      const delayMs = reportCompleted ? 2300 : 400;

      completeTimeoutRef.current = setTimeout(() => {
        onCompleteRef.current?.({ issues: state.issues, reviewId: state.reviewId });
      }, delayMs);
    }
    return () => {
      if (completeTimeoutRef.current) {
        clearTimeout(completeTimeoutRef.current);
      }
    };
  }, [state.isStreaming, state.steps, state.issues, state.reviewId, state.error]);

  const handleCancel = () => {
    stop();
    navigate({ to: '/' });
  };

  const handleViewResults = () => {
    if (completeTimeoutRef.current) {
      clearTimeout(completeTimeoutRef.current);
    }
    stop();
    onCompleteRef.current?.({ issues: state.issues, reviewId: state.reviewId });
  };

  const handleSetupProvider = () => {
    stop();
    navigate({ to: '/settings/providers' });
  };

  const handleSwitchMode = () => {
    stop();
    const newMode = mode === 'staged' ? 'unstaged' : 'staged';
    navigate({ to: '/review', search: { mode: newMode }, replace: true });
    hasStartedRef.current = false;
  };

  const isNoDiffError =
    state.error?.includes('No staged changes') ||
    state.error?.includes('No unstaged changes');

  const diffStep = state.steps.find(s => s.id === 'diff');
  const isCheckingForChanges = state.isStreaming &&
    diffStep?.status !== 'completed' &&
    diffStep?.status !== 'error';

  const progressSteps = useMemo(
    () => mapStepsToProgressData(state.steps, state.agents),
    [state.steps, state.agents]
  );

  const logEntries = useMemo(
    () => convertAgentEventsToLogEntries(state.events.filter(e => e.type !== 'enrich_progress')),
    [state.events]
  );

  const metrics = useMemo(() => ({
    filesProcessed: state.fileProgress.completed.size,
    filesTotal: state.fileProgress.total || state.fileProgress.completed.size,
    issuesFound: state.issues.length,
    elapsed: 0,
  }), [state.fileProgress.completed.size, state.fileProgress.total, state.issues.length]);

  // Show loading before start() is called (hasStartedRef is false) AND while checking for changes
  const isInitializing = !hasStartedRef.current && isConfigured && !configLoading;

  const loadingMessage = configLoading
    ? 'Loading...'
    : (isCheckingForChanges || isInitializing)
      ? 'Checking for changes...'
      : null;

  if (loadingMessage) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-gray-500 font-mono text-sm" role="status" aria-live="polite">
          {loadingMessage}
        </div>
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

  if (isNoDiffError) {
    return (
      <NoChangesView
        mode={mode}
        onBack={handleCancel}
        onSwitchMode={handleSwitchMode}
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
      startTime={state.startedAt ?? undefined}
      onViewResults={handleViewResults}
      onCancel={handleCancel}
    />
  );
}
