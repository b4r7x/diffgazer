import { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ReviewProgressView } from './review-progress-view';
import { ApiKeyMissingView } from './api-key-missing-view';
import { NoChangesView } from './no-changes-view';
import { useReviewStream } from '../hooks/use-review-stream';
import { useReviewSettings } from '../hooks/use-review-settings';
import { useContextSnapshot } from '../hooks/use-context-snapshot';
import { useConfigContext } from '@/app/providers/config-provider';
import { OPENROUTER_PROVIDER_ID } from '@/config/constants';
import { convertAgentEventsToLogEntries } from '@stargazer/core/review';
import type { ProgressStepData, ProgressStatus } from '@/components/ui/progress';
import type { StepState, AgentState, AgentStatus } from '@stargazer/schemas/events';
import type { ProgressSubstepData } from '@stargazer/schemas/ui';
import type { ReviewMode } from '../types';
import { ReviewErrorCode } from '@stargazer/schemas/review';
import type { ReviewIssue } from '@stargazer/schemas/review';

export interface ReviewCompleteData {
  issues: ReviewIssue[];
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
    case 'error': return 'error';
  }
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength - 3) + '...';
}

function deriveSubstepsFromAgents(agents: AgentState[]): ProgressSubstepData[] {
  return agents.map(agent => ({
    id: agent.id,
    tag: agent.meta.badgeLabel,
    label: agent.meta.name,
    status: mapAgentToSubstepStatus(agent.status),
    detail: agent.status === 'running'
      ? `${Math.round(agent.progress)}%${agent.currentAction ? ` · ${truncateText(agent.currentAction, 40)}` : ''}`
      : agent.status === 'complete'
        ? `${agent.issueCount} issue${agent.issueCount === 1 ? '' : 's'}`
        : agent.status === 'error'
          ? 'error'
          : 'queued',
  }));
}

function mapStepsToProgressData(
  steps: StepState[],
  agents: AgentState[]
): ProgressStepData[] {
  return steps.map(step => {
    const substeps = step.id === 'review' && agents.length > 0
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
 * 2. Shows ReviewProgressView during review
 * 3. Calls onComplete when done (parent can switch to results view)
 */
export function ReviewContainer({ mode, onComplete }: ReviewContainerProps) {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const { isConfigured, isLoading: configLoading, provider, model } = useConfigContext();
  const { state, start, stop, resume } = useReviewStream();
  const { loading: settingsLoading, defaultLenses } = useReviewSettings();

  const contextStep = state.steps.find((step) => step.id === "context");
  const contextSnapshot = useContextSnapshot(
    state.reviewId,
    state.isStreaming,
    contextStep?.status === "completed"
  );

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
    if (!state.reviewId) return;
    if (params.reviewId === state.reviewId) return;

    navigate({
      to: '/review/$reviewId',
      params: { reviewId: state.reviewId },
      search: (prev: Record<string, unknown>) => prev, // Preserve query params (mode)
      replace: true,
    });
  }, [state.reviewId, params.reviewId, navigate]);

  // Router's beforeLoad already validates UUID format, so we can trust params.reviewId
  useEffect(() => {
    if (hasStartedRef.current) return;
    if (configLoading) return;
    if (settingsLoading) return;
    if (!isConfigured) return;
    hasStartedRef.current = true;

    const options = {
      mode,
      lenses: defaultLenses,
    };

    if (params.reviewId) {
      // Try to resume existing session.
      resume(params.reviewId)
        .then((result) => {
          if (result.ok) return;

          if (result.error.code === ReviewErrorCode.SESSION_STALE) {
            // Repository state changed - cancel stale session and start a new review.
            start(options);
            return;
          }

          if (result.error.code === ReviewErrorCode.SESSION_NOT_FOUND) {
            // Session not active anymore - let parent load from persisted storage.
            onCompleteRef.current?.({
              issues: [],
              reviewId: params.reviewId ?? null,
              resumeFailed: true,
            });
          }
        })
        .catch(() => {
          // For transport/runtime errors, hook already set error state.
        });
    } else {
      // Start new review
      start(options);
    }
  }, [mode, start, resume, configLoading, isConfigured, params.reviewId, settingsLoading, defaultLenses]);

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
    () => convertAgentEventsToLogEntries(state.events),
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

  const loadingMessage = configLoading || settingsLoading
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
    const missingModel = provider === OPENROUTER_PROVIDER_ID && !model;
    return (
      <ApiKeyMissingView
        activeProvider={provider}
        missingModel={missingModel}
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
      agents={state.agents}
      metrics={metrics}
      isRunning={state.isStreaming}
      error={state.error}
      startTime={state.startedAt ?? undefined}
      contextSnapshot={contextSnapshot}
      onViewResults={handleViewResults}
      onCancel={handleCancel}
    />
  );
}
