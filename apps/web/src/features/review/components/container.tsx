import { usePageFooter } from "@diffgazer/core/footer";
import { getProviderDisplay } from "@diffgazer/core/providers";
import {
  CONFIGURE_PROVIDER_LABEL,
  classifyReviewStreamError,
  ENTER_API_KEY_LABEL,
  type FailedTerminalOutcome,
  isCredentialReconnectReadiness,
  isSessionTerminationCode,
  mapStepsToProgressData,
  savedRunExists,
} from "@diffgazer/core/review";
import type { ReviewMode, UsageAvailability } from "@diffgazer/core/schemas/review";
import { Navigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { CenteredStatus } from "@/components/shared/centered-status";
import { useConfigActions, useConfigData } from "@/hooks/use-config";
import { type ReviewCompleteData, useReviewLifecycle } from "../hooks/use-lifecycle";
import {
  ApiKeyMissingView,
  ConfigurationErrorView,
  ReviewStartErrorView,
  ReviewTerminalReceiptView,
} from "./api-key-missing-view";
import { NoChangesView } from "./no-changes-view";
import { ReviewProgressView } from "./progress-view";
import { ReviewTerminalErrorView } from "./terminal-error-view";

export type { ReviewCompleteData };

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
  const { loadState, configurations } = useConfigData();
  const { refresh } = useConfigActions();
  const {
    state,
    gate,
    contextSnapshot,
    contextRefreshError,
    retryContextRefresh,
    loadingMessage,
    readiness,
    selectedConfiguration,
    canStart,
    isCompleting,
    isTransitionPending,
    startError,
    handleCancel,
    handleBack,
    handleViewResults,
    handleViewRun,
    handleRetry,
    handleSetupProvider,
    handleChangeModel,
    handleSwitchMode,
  } = useReviewLifecycle({ mode, allowResumeWithoutSetup, onComplete, onStreamNotFound });

  // A failure the server reported after the write has a saved run behind it,
  // and that record — not this dead live screen — is the account of what the
  // run produced. So the container hands over the moment the stream settles
  // instead of parking on a progress view whose only remaining use is one
  // keypress.
  const settledError = !state.isStreaming && state.error ? state.error : null;
  const settledRunWithRecord =
    settledError &&
    state.reviewId &&
    savedRunExists(state.orchestratorStats.lensStats, state.errorCode)
      ? state.reviewId
      : null;
  // Everything else that settles is a dead end and takes the whole frame: the
  // log behind it stopped and the live layout has nothing left to show. A
  // dropped transport is the exception — its Retry reconnects a run that is
  // still going — and so is a terminated session, whose streamed findings are
  // exactly what the user must not lose to a full-frame card.
  const keepsLiveScreen = isSessionTerminationCode(state.errorCode ?? "");
  const settledFailure =
    settledError && !settledRunWithRecord && !keepsLiveScreen
      ? {
          error: settledError,
          guidance: classifyReviewStreamError(
            settledError,
            state.errorCode,
            selectedConfiguration?.transportFamily,
          ),
        }
      : null;
  const advancedRunId = useRef<string | null>(null);

  useEffect(() => {
    if (!settledRunWithRecord || advancedRunId.current === settledRunWithRecord) {
      return;
    }
    advancedRunId.current = settledRunWithRecord;
    handleViewRun(settledRunWithRecord);
  }, [settledRunWithRecord, handleViewRun]);

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
    lensStats: state.orchestratorStats.lensStats,
    metrics,
    startTime: state.startedAt ?? undefined,
    contextSnapshot,
    notices: state.notices,
    sizeWarning: state.sizeWarning,
  };

  if (loadState.status === "error") {
    return (
      <ConfigurationErrorView
        error={loadState.error}
        onRetry={() => void refresh()}
        onConfigureProvider={handleSetupProvider}
        onBack={handleCancel}
        actionsDisabled={isTransitionPending}
      />
    );
  }

  // An admitted run already knows every step it is about to take, so it draws
  // them pending and fills in, rather than holding a centered line that is torn
  // down — panes, footer keys and focus rebuilt — the moment the first step
  // lands. Only configuration we have not resolved keeps the plain readout,
  // because behind it there may be no run at all.
  const isStartingRun = gate === "loading" && canStart;

  if ((loadState.status === "loading" || gate === "loading") && !isStartingRun) {
    return <ReviewLoadingMessage message={loadingMessage ?? "Loading review..."} />;
  }

  if (startError) {
    return (
      <ReviewStartErrorView
        startError={startError}
        onConfigureProvider={handleSetupProvider}
        onBack={handleCancel}
        actionsDisabled={isTransitionPending}
      />
    );
  }

  if (gate === "unconfigured") {
    // The selection can stop resolving while the screen is mounted — the
    // configuration is deleted or deselected elsewhere — and then there is no
    // readiness to explain the gate. With nothing configured at all this is a
    // fresh install, and setup belongs to the onboarding wizard, not a gate.
    // Otherwise it takes the retryable configuration gate; the gate must never
    // fall through to an inert, empty progress view.
    if (!readiness) {
      if (configurations.length === 0) {
        return <Navigate to="/onboarding" replace />;
      }
      return (
        <ConfigurationErrorView
          onRetry={() => void refresh()}
          onConfigureProvider={handleSetupProvider}
          onBack={handleCancel}
          actionsDisabled={isTransitionPending}
        />
      );
    }

    return (
      <ApiKeyMissingView
        readiness={readiness}
        productLabel={
          selectedConfiguration ? getProviderDisplay(selectedConfiguration.productId) : undefined
        }
        meta={
          selectedConfiguration
            ? getProviderDisplay(
                selectedConfiguration.productId,
                selectedConfiguration.selectedModelId ?? undefined,
              )
            : undefined
        }
        // The button leaves for the providers screen, so it is named for where
        // it goes. Naming it after `readiness.action` promised a Test, an
        // inspect or a model pick this gate never performs.
        primaryLabel={
          isCredentialReconnectReadiness(readiness) ? ENTER_API_KEY_LABEL : CONFIGURE_PROVIDER_LABEL
        }
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

  if (settledFailure && settledFailure.guidance.kind !== "transport") {
    return (
      <ReviewTerminalErrorView
        error={settledFailure.error}
        guidance={settledFailure.guidance}
        onBack={handleBack}
        // "Change model" opens the model dialog on arrival; the other provider
        // recoveries land on the page itself.
        onConfigureProvider={
          settledFailure.guidance.kind === "model-incompatible"
            ? handleChangeModel
            : handleSetupProvider
        }
        actionsDisabled={isTransitionPending}
      />
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
      contextRefreshError={contextRefreshError}
      onRetryContextRefresh={retryContextRefresh}
      onRetry={handleRetry}
      onViewRun={handleViewRun}
      onViewResults={isCompleting ? handleViewResults : undefined}
      onCancel={handleCancel}
      onBack={handleBack}
      cancelDisabled={isTransitionPending}
    />
  );
}
