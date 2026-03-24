import { useEffect, type ReactElement } from "react";
import { Box, Text } from "ink";
import { useReviewLifecycle } from "../hooks/use-review-lifecycle.js";
import { ReviewProgressView } from "./review-progress-view.js";
import { ReviewSummaryView } from "./review-summary-view.js";
import { ReviewResultsView } from "./review-results-view.js";

interface ReviewContainerProps {
  mode?: "unstaged" | "staged";
  reviewId?: string;
}

export function ReviewContainer({
  mode,
  reviewId,
}: ReviewContainerProps): ReactElement {
  const { state, start, goToSummary, goToResults, reset } =
    useReviewLifecycle();

  useEffect(() => {
    if (state.phase === "idle" && mode) {
      start(mode);
    }
  }, []);

  switch (state.phase) {
    case "idle":
      return (
        <Box>
          <Text>Starting review...</Text>
        </Box>
      );

    case "streaming":
      return (
        <ReviewProgressView
          steps={state.steps}
          logEntries={state.logEntries}
          onCancel={reset}
        />
      );

    case "summary":
      if (!state.summary) {
        return (
          <Box>
            <Text>Loading summary...</Text>
          </Box>
        );
      }
      return (
        <ReviewSummaryView
          summary={state.summary}
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
