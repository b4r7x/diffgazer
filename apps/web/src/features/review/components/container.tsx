import { usePageFooter } from "@diffgazer/core/footer";
import { convertAgentEventsToLogEntries, mapStepsToProgressData } from "@diffgazer/core/review";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { CenteredStatus } from "@/components/shared/centered-status";
import { type ReviewCompleteData, useReviewLifecycle } from "../hooks/use-lifecycle";
import { ApiKeyMissingView } from "./api-key-missing-view";
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
  const {
    state,
    gate,
    contextSnapshot,
    loadingMessage,
    provider,
    model,
    handleCancel,
    handleViewResults,
    handleSetupProvider,
    handleSwitchMode,
  } = useReviewLifecycle({ mode, onComplete, onStreamNotFound });

  const steps = mapStepsToProgressData(state.steps, state.agents);
  const entries = convertAgentEventsToLogEntries(state.events);
  const metrics = {
    filesProcessed: state.fileProgress.completed.length,
    filesTotal: state.fileProgress.total,
    issuesFound: state.issues.length,
  };
  const progressData = {
    steps,
    entries,
    agents: state.agents,
    metrics,
    startTime: state.startedAt ?? undefined,
    contextSnapshot,
    notices: state.notices,
  };

  if (gate === "loading") {
    return <ReviewLoadingMessage message={loadingMessage ?? "Loading review..."} />;
  }

  if (gate === "unconfigured") {
    return (
      <ApiKeyMissingView
        activeProvider={provider}
        missingModel={!model}
        onNavigateSettings={handleSetupProvider}
        onBack={handleCancel}
      />
    );
  }

  if (gate === "no-diff") {
    return <NoChangesView mode={mode} onBack={handleCancel} onSwitchMode={handleSwitchMode} />;
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
      onViewResults={canViewResults ? handleViewResults : undefined}
      onCancel={handleCancel}
    />
  );
}
