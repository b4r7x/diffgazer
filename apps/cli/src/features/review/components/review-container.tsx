import { useEffect, type ReactElement } from "react";
import { Box } from "ink";
import { useNavigation } from "../../../app/navigation-context.js";
import { useReviewLifecycle } from "../hooks/use-review-lifecycle.js";
import { convertAgentEventsToLogEntries } from "@diffgazer/core/review";
import { Spinner } from "../../../components/ui/spinner.js";
import { Callout } from "../../../components/ui/callout.js";
import { Button } from "../../../components/ui/button.js";
import { ReviewProgressView } from "./review-progress-view.js";
import { ReviewSummaryView } from "./review-summary-view.js";
import { ReviewResultsView } from "./review-results-view.js";
import type { ReviewMode } from "@diffgazer/schemas/review";

interface ReviewContainerProps {
  mode?: ReviewMode;
  reviewId?: string;
}

export function ReviewContainer({
  mode,
  reviewId,
}: ReviewContainerProps): ReactElement {
  const { navigate } = useNavigation();
  const { state, start, goToSummary, goToResults, reset } =
    useReviewLifecycle();

  useEffect(() => {
    if (mode) {
      start(mode);
    }
  }, []);

  if (state.loadingMessage) {
    return (
      <Box>
        <Spinner label={state.loadingMessage} />
      </Box>
    );
  }

  if (!state.isConfigured && !state.loadingMessage) {
    const missingModel = !state.model;
    return (
      <Box flexDirection="column" gap={1}>
        <Callout variant="warning">
          <Callout.Title>
            {missingModel
              ? "AI provider not configured"
              : `API key not configured for ${state.provider ?? "provider"}`}
          </Callout.Title>
          <Callout.Content>
            {missingModel
              ? "Set up an AI provider and model in Settings to start reviewing code."
              : "Add your API key in Settings to start reviewing code."}
          </Callout.Content>
        </Callout>
        <Box gap={2}>
          <Button
            variant="primary"
            isActive
            onPress={() => {
              reset();
              navigate({ screen: "settings/providers" });
            }}
          >
            Go to Settings
          </Button>
          <Button variant="secondary" onPress={reset}>
            Back
          </Button>
        </Box>
      </Box>
    );
  }

  if (state.isNoDiffError) {
    const otherMode = mode === "staged" ? "unstaged" : "staged";
    return (
      <Box flexDirection="column" gap={1}>
        <Callout variant="info">
          <Callout.Title>No changes detected</Callout.Title>
          <Callout.Content>
            {`No ${mode ?? "unstaged"} changes found in the current repository.`}
          </Callout.Content>
        </Callout>
        <Box gap={2}>
          <Button
            variant="primary"
            isActive
            onPress={() => {
              reset();
              start(otherMode);
            }}
          >
            {`Try ${otherMode} changes`}
          </Button>
          <Button variant="secondary" onPress={reset}>
            Back
          </Button>
        </Box>
      </Box>
    );
  }

  if (
    state.error &&
    state.phase !== "streaming" &&
    state.phase !== "completing"
  ) {
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
          steps={state.steps}
          agents={state.agents}
          logEntries={convertAgentEventsToLogEntries(state.events)}
          fileProgress={state.fileProgress}
          isStreaming={state.phase === "streaming"}
          error={state.error}
          onCancel={reset}
        />
      );

    case "summary":
      return (
        <ReviewSummaryView
          issues={state.issues}
          reviewId={state.reviewId ?? undefined}
          durationMs={state.durationMs}
          onContinue={goToResults}
          onBack={reset}
        />
      );

    case "results":
      return (
        <ReviewResultsView issues={state.issues} onBack={goToSummary} />
      );
  }
}
