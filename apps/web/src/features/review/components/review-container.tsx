import { useMemo } from 'react';
import { ReviewProgressView } from './review-progress-view';
import { ApiKeyMissingView } from './api-key-missing-view';
import { NoChangesView } from './no-changes-view';
import { useReviewLifecycle, type ReviewCompleteData } from '../hooks/use-review-lifecycle';
import { useContextSnapshot } from '../hooks/use-context-snapshot';
import { OPENROUTER_PROVIDER_ID } from '@/config/constants';
import { convertAgentEventsToLogEntries } from '@stargazer/core/review';
import type { ProgressStepData, ProgressStatus } from '@/components/ui/progress';
import type { StepState, AgentState, AgentStatus } from '@stargazer/schemas/events';
import type { ProgressSubstepData } from '@stargazer/schemas/ui';
import type { ReviewMode } from '../types';

export type { ReviewCompleteData };

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
  const {
    state,
    isConfigured,
    provider,
    model,
    loadingMessage,
    isNoDiffError,
    handleCancel,
    handleViewResults,
    handleSetupProvider,
    handleSwitchMode,
  } = useReviewLifecycle({ mode, onComplete });

  const contextStep = state.steps.find((step) => step.id === "context");
  const contextSnapshot = useContextSnapshot(
    state.reviewId,
    state.isStreaming,
    contextStep?.status === "completed"
  );

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
