import { useReviewContext } from "@diffgazer/core/api/hooks";
import { convertAgentEventsToLogEntries, mapStepsToProgressData } from "@diffgazer/core/review";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { Box } from "ink";
import { type ReactElement, useEffect, useRef } from "react";
import { useNavigation } from "../../../app/providers/navigation-provider";
import { Button } from "../../../components/ui/button";
import { Callout } from "../../../components/ui/callout";
import { Spinner } from "../../../components/ui/spinner";
import { useReviewLifecycle } from "../hooks/use-lifecycle";
import { ApiKeyMissingView } from "./api-key-missing-view";
import { NoChangesView } from "./no-changes-view";
import { ReviewProgressView } from "./progress-view";
import { ReviewResultsView } from "./results-view";
import { ReviewSummaryView } from "./summary-view";

interface ReviewContainerProps {
  mode?: ReviewMode;
  reviewId?: string;
}

export function ReviewContainer({ mode }: ReviewContainerProps): ReactElement {
  const { navigate } = useNavigation();
  const { state, start, goToSummary, goToResults, reset } = useReviewLifecycle();

  const contextStep = state.steps.find((s) => s.id === "context");
  const contextReady = contextStep?.status === "completed" && !!state.reviewId;
  const { data: contextData } = useReviewContext({ enabled: contextReady });
  const contextSnapshot = contextReady ? (contextData ?? null) : null;

  const hasStarted = useRef(false);

  useEffect(() => {
    if (mode && !hasStarted.current) {
      hasStarted.current = true;
      start(mode);
    }
  }, [mode, start]);

  if (state.loadingMessage) {
    return (
      <Box>
        <Spinner label={state.loadingMessage} />
      </Box>
    );
  }

  if (!state.isConfigured && !state.loadingMessage) {
    return (
      <ApiKeyMissingView
        provider={state.provider ?? undefined}
        missingModel={!state.model}
        onGoToSettings={() => {
          reset();
          navigate({ screen: "settings/providers" });
        }}
        onBack={reset}
      />
    );
  }

  if (state.isNoDiffError) {
    const currentMode = mode ?? "unstaged";
    const otherMode = currentMode === "staged" ? "unstaged" : "staged";
    return (
      <NoChangesView
        mode={currentMode}
        onSwitchMode={() => {
          reset();
          start(otherMode);
        }}
        onBack={reset}
      />
    );
  }

  if (state.error && state.phase !== "streaming" && state.phase !== "completing") {
    return (
      <Box flexDirection="column" gap={1}>
        <Callout variant="error">
          <Callout.Title>Review failed</Callout.Title>
          <Callout.Content>{state.error}</Callout.Content>
        </Callout>
        <Box gap={2}>
          <Button variant="secondary" isActive onPress={reset}>
            Back
          </Button>
        </Box>
      </Box>
    );
  }

  switch (state.phase) {
    case "loading":
      return (
        <Box>
          <Spinner label="Starting review..." />
        </Box>
      );

    case "streaming":
    case "completing":
      return (
        <ReviewProgressView
          progressSteps={mapStepsToProgressData(state.steps, state.agents)}
          agents={state.agents}
          logEntries={convertAgentEventsToLogEntries(state.events)}
          fileProgress={state.fileProgress}
          isStreaming={state.phase === "streaming"}
          error={state.error}
          onCancel={reset}
          issuesFound={state.issues.length}
          startedAt={state.startedAt}
          contextSnapshot={contextSnapshot}
          onViewResults={goToSummary}
        />
      );

    case "summary":
      return (
        <ReviewSummaryView
          issues={state.issues}
          reviewId={state.reviewId ?? undefined}
          durationMs={state.startedAt ? Date.now() - state.startedAt.getTime() : undefined}
          onContinue={goToResults}
          onBack={reset}
        />
      );

    case "results":
      return (
        <ReviewResultsView
          issues={state.issues}
          reviewId={state.reviewId ?? undefined}
          onBack={goToSummary}
        />
      );
  }
}
