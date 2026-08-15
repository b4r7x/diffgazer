import { usePageFooter } from "@diffgazer/core/footer";
import { getAlternateReviewMode, mapStepsToProgressDataWithAgents } from "@diffgazer/core/review";
import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";
import { BACK_SHORTCUTS } from "@diffgazer/core/schemas/presentation";
import type { ReviewMode, UsageAvailability } from "@diffgazer/core/schemas/review";
import { Box, useInput } from "ink";
import { type ReactElement, useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Callout } from "../../../components/ui/callout";
import { Spinner } from "../../../components/ui/spinner";
import { useNavigation } from "../../../hooks/use-navigation";
import { useReviewLifecycle } from "../hooks/use-lifecycle";
import {
  ApiKeyMissingView,
  ConfigurationErrorView,
  type FailedTerminalOutcome,
  ReviewTerminalReceiptView,
} from "./api-key-missing-view";
import { NoChangesView } from "./no-changes-view";
import { ReviewProgressView } from "./progress-view/view";
import { ReviewResultsView } from "./results-view";
import { ReviewSummaryView } from "./summary-view";

interface ReviewStreamContainerProps {
  // Matches the review route, which carries no file-selection mode.
  mode?: Exclude<ReviewMode, "files">;
  reviewId?: string;
  allowResumeWithoutSetup?: boolean;
  onStreamNotFound?: (reviewId: string) => void;
}

interface ReviewTerminalReceiptContainerProps {
  terminalOutcome: FailedTerminalOutcome;
  usageAvailability?: UsageAvailability;
  onBack: () => void;
}

type ReviewContainerProps = ReviewStreamContainerProps | ReviewTerminalReceiptContainerProps;

function ReviewLoadingView({ message }: { message: string }): ReactElement {
  usePageFooter({ shortcuts: [] });

  // Same placement every other loading state in the TUI uses: the run takes the
  // frame it is about to fill instead of hanging off the top-left corner.
  return (
    <Box flexGrow={1} alignItems="center" justifyContent="center">
      <Spinner label={message} />
    </Box>
  );
}

function ReviewTerminalErrorView({
  error,
  onBack,
}: {
  error: string;
  onBack: () => void;
}): ReactElement {
  usePageFooter({ shortcuts: [], rightShortcuts: BACK_SHORTCUTS });
  useInput(
    (_input, key) => {
      if (key.escape) {
        onBack();
      }
    },
    { isActive: true },
  );

  return (
    <Box flexDirection="column" gap={1}>
      <Callout variant="error">
        <Callout.Title>Review failed</Callout.Title>
        <Callout.Content>{sanitizeTerminalText(error)}</Callout.Content>
      </Callout>
      <Box gap={2}>
        <Button variant="secondary" isActive onPress={onBack}>
          Back
        </Button>
      </Box>
    </Box>
  );
}

export function ReviewContainer(props: ReviewContainerProps): ReactElement {
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
  reviewId,
  allowResumeWithoutSetup = false,
  onStreamNotFound,
}: ReviewStreamContainerProps): ReactElement {
  const { navigate, goBack } = useNavigation();
  const { state, start, cancel, goToSummary, goToResults, retryConfig, reset } = useReviewLifecycle(
    {
      mode,
      reviewId,
      allowResumeWithoutSetup,
      onStreamNotFound,
    },
  );
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const switchingModeRef = useRef(false);

  function handleGateBack() {
    reset({ clearActiveSession: true });
    goBack();
  }

  function goToProviderSettings() {
    reset();
    navigate({ screen: "settings/providers" });
  }

  function handleRunningBack() {
    reset();
    navigate({ screen: "home" });
  }

  const hasStarted = useRef(false);

  useEffect(() => {
    if (mode && !reviewId && state.initState.status === "ready" && !hasStarted.current) {
      hasStarted.current = true;
      void start(mode);
    }
  }, [mode, reviewId, start, state.initState.status]);

  if (state.initState.status === "loading") {
    return <ReviewLoadingView message="Loading configuration..." />;
  }

  if (state.initState.status === "error") {
    return (
      <ConfigurationErrorView
        error={state.initState.error}
        onRetry={() => {
          void retryConfig();
        }}
        onGoToSettings={goToProviderSettings}
        onBack={handleGateBack}
      />
    );
  }

  // Configuration we cannot resolve yet is the only wait with nothing behind
  // it. Once the run is admitted the progress screen carries its own start (see
  // the phase switch below), so the frame the run is about to fill is never
  // replaced by a centered line.
  if (state.gate === "loading" && !state.canStart) {
    return <ReviewLoadingView message={state.loadingMessage ?? "Loading review..."} />;
  }

  if (state.gate === "unconfigured") {
    return (
      <ApiKeyMissingView
        productLabel={state.productLabel ?? undefined}
        meta={state.configurationDisplay ?? undefined}
        readiness={state.readiness}
        onGoToSettings={goToProviderSettings}
        onBack={handleGateBack}
      />
    );
  }

  if (state.gate === "no-diff") {
    const currentMode = state.mode;
    const otherMode = getAlternateReviewMode(currentMode);
    return (
      <NoChangesView
        mode={currentMode}
        disabled={isSwitchingMode}
        onSwitchMode={async () => {
          if (switchingModeRef.current) return;
          switchingModeRef.current = true;
          setIsSwitchingMode(true);
          try {
            const result = await start(otherMode);
            if (result === "setup-required") navigate({ screen: "settings/providers" });
          } finally {
            switchingModeRef.current = false;
            setIsSwitchingMode(false);
          }
        }}
        onBack={handleGateBack}
      />
    );
  }

  if (state.gate === "terminal-error") {
    return (
      <ReviewTerminalErrorView error={state.error ?? "Review failed."} onBack={handleGateBack} />
    );
  }

  if (state.error && state.phase !== "streaming" && state.phase !== "completing") {
    return <ReviewTerminalErrorView error={state.error} onBack={handleGateBack} />;
  }

  switch (state.phase) {
    // The session request is part of the run, not a screen of its own: the
    // steps it is about to walk are already known, so they are drawn pending
    // and fill in as the stream attaches. Escape stays live throughout, which
    // the centered loading frame never offered.
    case "loading":
    case "streaming":
    case "completing":
      return (
        <ReviewProgressView
          progressSteps={mapStepsToProgressDataWithAgents(state.steps, state.agents)}
          agents={state.agents}
          lensStats={state.completion.lensStats}
          events={state.events}
          fileProgress={state.fileProgress}
          isStreaming={state.isStreaming}
          error={state.error}
          errorCode={state.errorCode}
          transportFamily={state.transportFamily}
          notices={state.notices}
          onCancel={() => {
            void cancel().then((error) => {
              if (error) {
                return;
              }
              reset();
              navigate({ screen: "home" });
            });
          }}
          // Leaving is offered until the results are on their way: the run keeps
          // going server-side and home resumes it. The completion delay is the
          // one moment with a result about to land, so it holds the screen.
          onBack={state.phase === "completing" ? undefined : handleRunningBack}
          issuesFound={state.issues.length}
          startedAt={state.startedAt}
          completedAt={state.completedAt}
          reviewId={state.reviewId}
          contextSnapshot={state.contextSnapshot}
          contextRefreshError={state.contextRefreshError}
          onRetryContextRefresh={state.retryContextRefresh}
          // Offered only while the completion delay runs: before the run ends
          // there is no deduped result to show.
          onViewResults={state.phase === "completing" ? goToSummary : undefined}
          onGoToSettings={() => navigate({ screen: "settings/providers" })}
        />
      );

    case "summary":
      return (
        <ReviewSummaryView
          issues={state.issues}
          reviewId={state.reviewId ?? undefined}
          durationMs={
            state.startedAt && state.completedAt
              ? state.completedAt.getTime() - state.startedAt.getTime()
              : undefined
          }
          lensStats={state.completion.lensStats}
          droppedDuplicates={state.completion.droppedDuplicates}
          droppedBelowThreshold={state.completion.droppedBelowThreshold}
          minSeverity={state.completion.minSeverity}
          onContinue={goToResults}
          onBack={handleGateBack}
        />
      );

    case "results":
      return (
        <ReviewResultsView
          issues={state.issues}
          reviewId={state.reviewId ?? undefined}
          lensStats={state.completion.lensStats}
          droppedDuplicates={state.completion.droppedDuplicates}
          onBack={goToSummary}
        />
      );
  }
}
