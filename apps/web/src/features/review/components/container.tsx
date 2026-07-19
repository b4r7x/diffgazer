import { usePageFooter } from "@diffgazer/core/footer";
import { extractOrchestratorStats, mapStepsToProgressData } from "@diffgazer/core/review";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { CenteredStatus } from "@/components/shared/centered-status";
import { useConfigActions, useConfigData } from "@/hooks/use-config";
import { type ReviewCompleteData, useReviewLifecycle } from "../hooks/use-lifecycle";
import { ApiKeyMissingView, ConfigurationErrorView } from "./api-key-missing-view";
import { NoChangesView } from "./no-changes-view";
import { ReviewProgressView } from "./progress-view";

export type { ReviewCompleteData };

export interface ReviewContainerProps {
  mode: ReviewMode;
  onComplete?: (data: ReviewCompleteData) => void;
  onStreamNotFound?: (reviewId: string) => void;
}

export function ReviewLoadingMessage({ message }: { message: string }) {
  usePageFooter({ shortcuts: [] });

  return <CenteredStatus>{message}</CenteredStatus>;
}

export function ReviewContainer({ mode, onComplete, onStreamNotFound }: ReviewContainerProps) {
  const { loadState } = useConfigData();
  const { refresh } = useConfigActions();
  const {
    state,
    gate,
    contextSnapshot,
    loadingMessage,
    provider,
    isTransitionPending,
    handleCancel,
    handleBack,
    handleViewResults,
    handleRetry,
    handleSetupProvider,
    handleSwitchMode,
  } = useReviewLifecycle({ mode, onComplete, onStreamNotFound });

  const steps = mapStepsToProgressData(state.steps);
  const filesIncludedInPrompt = state.fileProgress.completed.length;
  const metrics = {
    filesProcessed: filesIncludedInPrompt,
    filesTotal: state.fileProgress.total,
    issuesFound: state.issues.length,
  };
  const progressData = {
    steps,
    events: state.events,
    agents: state.agents,
    lensStats: extractOrchestratorStats(state).lensStats,
    metrics,
    startTime: state.startedAt ?? undefined,
    contextSnapshot,
    notices: state.notices,
  };

  if (loadState.status === "error") {
    return (
      <ConfigurationErrorView
        onRetry={() => void refresh()}
        onBack={handleCancel}
        primaryDisabled={isTransitionPending}
      />
    );
  }

  if (loadState.status === "loading" || gate === "loading") {
    return <ReviewLoadingMessage message={loadingMessage ?? "Loading review..."} />;
  }

  if (gate === "unconfigured") {
    return (
      <ApiKeyMissingView
        activeProvider={provider}
        missing={loadState.setupStatus.missing}
        onNavigateSettings={handleSetupProvider}
        onBack={handleCancel}
        primaryDisabled={isTransitionPending}
      />
    );
  }

  if (gate === "no-diff") {
    return (
      <NoChangesView
        mode={mode}
        onBack={handleCancel}
        onSwitchMode={handleSwitchMode}
        switchDisabled={isTransitionPending}
      />
    );
  }

  // Enable View Results only once the report step is completed. The server now
  // emits step_complete("report") strictly AFTER the durable saveReview, so a
  // completed report step is equivalent to a successful terminal `complete` and
  // the saved review is guaranteed openable. Do NOT gate on !isStreaming alone --
  // that is also true after errors, which would navigate to an empty results page.
  const reportStep = state.steps.find((s) => s.id === "report");
  const canViewResults = reportStep?.status === "completed";

  return (
    <ReviewProgressView
      data={progressData}
      isRunning={state.isStreaming}
      error={state.error}
      errorCode={state.errorCode}
      reviewId={state.reviewId}
      onRetry={handleRetry}
      onViewResults={canViewResults ? handleViewResults : undefined}
      onCancel={handleCancel}
      onBack={handleBack}
      cancelDisabled={isTransitionPending}
    />
  );
}
