import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ReviewProgressView } from './review-progress-view';
import { ApiKeyMissingView } from './api-key-missing-view';
import { NoChangesView } from './no-changes-view';
import { useReviewStream } from '../hooks/use-review-stream';
import { useConfig } from '@/features/settings/hooks/use-config';
import { OPENROUTER_PROVIDER_ID } from '@/features/providers/constants';
import type { SettingsConfig } from '@stargazer/schemas/config';
import { convertAgentEventsToLogEntries } from '@stargazer/core/review';
import type { ProgressStepData, ProgressStatus } from '@/components/ui/progress';
import type { StepState, AgentState, AgentStatus } from '@stargazer/schemas/events';
import type { ProgressSubstepData } from '@stargazer/schemas/ui';
import type { ReviewMode } from '../types';
import { LensIdSchema, type LensId } from '@stargazer/schemas/review';
import type { ReviewIssue } from '@stargazer/schemas/review';
import type { ReviewContextResponse } from '@stargazer/api/types';
import { api } from '@/lib/api';

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
  const params = useParams({ strict: false }) as { reviewId?: string };
  const { isConfigured, isLoading: configLoading, provider, model } = useConfig();
  const { state, start, stop, resume } = useReviewStream();
  const [settings, setSettings] = useState<SettingsConfig | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [contextSnapshot, setContextSnapshot] = useState<ReviewContextResponse | null>(null);

  const hasStartedRef = useRef(false);
  const hasStreamedRef = useRef(false);
  const completeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);
  const contextFetchRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    api
      .getSettings()
      .then((data) => {
        if (!active) return;
        setSettings(data);
      })
      .catch(() => {
        if (!active) return;
        setSettings(null);
      })
      .finally(() => {
        if (!active) return;
        setSettingsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (state.isStreaming) {
      hasStreamedRef.current = true;
      setContextSnapshot(null);
      contextFetchRef.current = null;
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

  const contextStep = state.steps.find((step) => step.id === "context");

  useEffect(() => {
    if (!state.reviewId) return;
    if (contextFetchRef.current === state.reviewId) return;
    if (contextStep?.status !== "completed" && state.isStreaming) return;

    contextFetchRef.current = state.reviewId;
    api
      .getReviewContext()
      .then((data) => {
        setContextSnapshot(data);
      })
      .catch(() => {
        setContextSnapshot(null);
      });
  }, [contextStep?.status, state.isStreaming, state.reviewId]);

  // Router's beforeLoad already validates UUID format, so we can trust params.reviewId
  useEffect(() => {
    if (hasStartedRef.current) return;
    if (configLoading) return;
    if (settingsLoading) return;
    if (!isConfigured) return;
    hasStartedRef.current = true;

    const fallbackLenses: LensId[] = ["correctness", "security", "performance", "simplicity", "tests"];
    const parsedLenses = settings?.defaultLenses?.filter(
      (lens): lens is LensId => LensIdSchema.safeParse(lens).success
    ) ?? [];
    const defaultLenses: LensId[] = parsedLenses.length > 0 ? parsedLenses : fallbackLenses;

    const options = {
      mode,
      lenses: defaultLenses,
    };

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
  }, [mode, start, resume, configLoading, isConfigured, params.reviewId, settingsLoading, settings?.defaultLenses]);

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
