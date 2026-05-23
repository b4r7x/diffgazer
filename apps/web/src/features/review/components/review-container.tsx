import { ReviewProgressView } from './review-progress-view';
import { ApiKeyMissingView } from './api-key-missing-view';
import { NoChangesView } from './no-changes-view';
import { useReviewLifecycle, type ReviewCompleteData } from '../hooks/use-review-lifecycle';
import { useReviewContext } from '@diffgazer/core/api/hooks';
import { convertAgentEventsToLogEntries, mapStepsToProgressData } from '@diffgazer/core/review';
import type { ReviewMode } from '@diffgazer/core/schemas/review';
import { usePageFooter } from "@diffgazer/core/footer";

export type { ReviewCompleteData };

export interface ReviewContainerProps {
  mode: ReviewMode;
  onComplete?: (data: ReviewCompleteData) => void;
  onStreamNotFound?: (reviewId: string) => void;
}

export function ReviewLoadingMessage({ message }: { message: string }) {
  usePageFooter({ shortcuts: [] });

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-tui-muted font-mono text-sm" role="status" aria-live="polite">
        {message}
      </div>
    </div>
  );
}

export function ReviewContainer({ mode, onComplete, onStreamNotFound }: ReviewContainerProps) {
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
  } = useReviewLifecycle({ mode, onComplete, onStreamNotFound });

  const contextStep = state.steps.find(s => s.id === 'context');
  const contextReady = contextStep?.status === 'completed' && !!state.reviewId;
  const { data: contextData } = useReviewContext({ enabled: contextReady });
  const contextSnapshot = contextReady ? contextData ?? null : null;

  const steps = mapStepsToProgressData(state.steps, state.agents);
  const entries = convertAgentEventsToLogEntries(state.events);
  const metrics = {
    filesProcessed: state.fileProgress.completed.length,
    filesTotal: state.fileProgress.total || state.fileProgress.completed.length,
    issuesFound: state.issues.length,
  };
  const progressData = {
    steps,
    entries,
    agents: state.agents,
    metrics,
    startTime: state.startedAt ?? undefined,
    contextSnapshot,
  };

  if (loadingMessage) {
    return <ReviewLoadingMessage message={loadingMessage} />;
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

  // Only enable View Results after the terminal complete event from the server
  // (report step completed). Do NOT gate on !isStreaming alone -- that is also
  // true after errors, which would let Enter navigate to an empty results page.
  const reportStep = state.steps.find(s => s.id === 'report');
  const canViewResults = reportStep?.status === 'completed';

  return (
    <ReviewProgressView
      data={progressData}
      isRunning={state.isStreaming}
      error={state.error}
      onViewResults={canViewResults ? handleViewResults : undefined}
      onCancel={handleCancel}
    />
  );
}
