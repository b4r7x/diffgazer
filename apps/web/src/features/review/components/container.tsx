import { usePageFooter } from "@diffgazer/core/footer";
import { extractOrchestratorStats, mapStepsToProgressData } from "@diffgazer/core/review";
import type {
  ReviewMode,
  TerminalOutcome,
  UsageAvailability,
} from "@diffgazer/core/schemas/review";
import { CenteredStatus } from "@/components/shared/centered-status";
import { useConfigActions, useConfigData } from "@/hooks/use-config";
import { type ReviewCompleteData, useReviewLifecycle } from "../hooks/use-lifecycle";
import { getReadinessActionLabel } from "../lib/readiness-presentation";
import {
  ApiKeyMissingView,
  ConfigurationErrorView,
  ReviewTerminalErrorView,
  ReviewTerminalReceiptView,
} from "./api-key-missing-view";
import { NoChangesView } from "./no-changes-view";
import { ReviewProgressView } from "./progress-view";

export type { ReviewCompleteData };

export type FailedTerminalOutcome = Exclude<TerminalOutcome, "completed">;

interface ReviewStreamProps {
  mode: ReviewMode;
  allowResumeWithoutSetup?: boolean;
  onComplete?: (data: ReviewCompleteData) => void;
  onStreamNotFound?: (reviewId: string) => void;
}

/**
 * A review that already reached a failed terminal outcome has nothing left to
 * stream, so the receipt is rendered without engaging the review lifecycle; the
 * route supplies the exit because there is no session to cancel.
 */
interface ReviewTerminalReceiptProps {
  mode?: ReviewMode;
  terminalOutcome: FailedTerminalOutcome;
  usageAvailability?: UsageAvailability;
  onBack: () => void;
}

export type ReviewContainerProps = ReviewStreamProps | ReviewTerminalReceiptProps;

export function ReviewLoadingMessage({ message }: { message: string }) {
  usePageFooter({ shortcuts: [] });

  return <CenteredStatus>{message}</CenteredStatus>;
}

export function ReviewContainer(props: ReviewContainerProps) {
  if ("terminalOutcome" in props) {
    return (
      <ReviewTerminalReceiptView
        outcome={props.terminalOutcome}
        usageAvailability={props.usageAvailability}
        onBack={props.onBack}
      />
    );
  }
  return <ReviewStreamContainer {...props} />;
}

function ReviewStreamContainer({
  mode,
  allowResumeWithoutSetup,
  onComplete,
  onStreamNotFound,
}: ReviewStreamProps) {
  const { loadState } = useConfigData();
  const { refresh } = useConfigActions();
  const {
    state,
    gate,
    contextSnapshot,
    loadingMessage,
    readiness,
    selectedConfiguration,
    isCompleting,
    isTransitionPending,
    handleCancel,
    handleBack,
    handleViewResults,
    handleRetry,
    handleSetupProvider,
    handleSwitchMode,
  } = useReviewLifecycle({ mode, allowResumeWithoutSetup, onComplete, onStreamNotFound });

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

  if (gate === "unconfigured" && readiness) {
    return (
      <ApiKeyMissingView
        readiness={readiness}
        productLabel={selectedConfiguration?.productId}
        primaryLabel={getReadinessActionLabel(readiness.action)}
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

  if (gate === "terminal-error") {
    return (
      <ReviewTerminalErrorView message={state.error ?? "Review failed."} onBack={handleBack} />
    );
  }

  // View Results skips the completion delay, so it is offered only once the
  // completion machine is actually delaying: the report step can finish while
  // the stream is still deduping issues, and skipping then would hand over a
  // partial result with no duration.
  return (
    <ReviewProgressView
      data={progressData}
      isRunning={state.isStreaming}
      error={state.error}
      errorCode={state.errorCode}
      transportFamily={selectedConfiguration?.transportFamily}
      reviewId={state.reviewId}
      onRetry={handleRetry}
      onViewResults={isCompleting ? handleViewResults : undefined}
      onCancel={handleCancel}
      onBack={handleBack}
      cancelDisabled={isTransitionPending}
    />
  );
}
