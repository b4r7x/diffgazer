import { ReviewProgressView } from './review-progress-view';
import { ApiKeyMissingView } from './api-key-missing-view';
import { NoChangesView } from './no-changes-view';
import { useReviewLifecycle, type ReviewCompleteData } from '../hooks/use-review-lifecycle';
import { useContextSnapshot } from '../hooks/use-context-snapshot';
import { convertAgentEventsToLogEntries } from '@stargazer/core/review';
import { mapStepsToProgressData } from './review-container.utils';
import type { ReviewMode } from '@stargazer/schemas/review';

export type { ReviewCompleteData };

export interface ReviewContainerProps {
  mode: ReviewMode;
  onComplete?: (data: ReviewCompleteData) => void;
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

  const progressData = (() => {
    const steps = mapStepsToProgressData(state.steps, state.agents);
    const entries = convertAgentEventsToLogEntries(state.events);
    const metrics = {
      filesProcessed: state.fileProgress.completed.length,
      filesTotal: state.fileProgress.total || state.fileProgress.completed.length,
      issuesFound: state.issues.length,
    };
    return {
      steps,
      entries,
      agents: state.agents,
      metrics,
      startTime: state.startedAt ?? undefined,
      contextSnapshot,
    };
  })();

  if (loadingMessage) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-tui-muted font-mono text-sm" role="status" aria-live="polite">
          {loadingMessage}
        </div>
      </div>
    );
  }

  if (!isConfigured) {
    const missingModel = !model;
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
      data={progressData}
      isRunning={state.isStreaming}
      error={state.error}
      onViewResults={handleViewResults}
      onCancel={handleCancel}
    />
  );
}
