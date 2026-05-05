import { useEffect, useReducer, type ReactElement } from "react";
import { Box } from "ink";
import { useNavigation } from "../navigation-context.js";
import { useScope } from "../../hooks/use-scope.js";
import { usePageFooter } from "../../hooks/use-page-footer.js";
import { useBackHandler } from "../../hooks/use-back-handler.js";
import { useReview } from "@diffgazer/core/api/hooks";
import { ReviewContainer } from "../../features/review/components/review-container.js";
import { ReviewResultsView } from "../../features/review/components/review-results-view.js";
import { ReviewSummaryView } from "../../features/review/components/review-summary-view.js";
import { Spinner } from "../../components/ui/spinner.js";
import { REVIEW_SHORTCUTS } from "../../config/navigation.js";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";

type CliReviewMode = "unstaged" | "staged";

// --- State machine ---

interface SavedReviewData {
  issues: ReviewIssue[];
  reviewId: string;
  durationMs: number | undefined;
}

type ScreenPhase =
  | { phase: "loading-saved" }
  | { phase: "streaming"; mode: CliReviewMode }
  | { phase: "summary"; data: SavedReviewData }
  | { phase: "results"; data: SavedReviewData };

type ScreenAction =
  | { type: "LOAD_SAVED" }
  | { type: "START_STREAMING"; mode: CliReviewMode }
  | { type: "SHOW_SUMMARY"; data: SavedReviewData }
  | { type: "SHOW_RESULTS"; data: SavedReviewData };

function screenReducer(_state: ScreenPhase, action: ScreenAction): ScreenPhase {
  switch (action.type) {
    case "LOAD_SAVED":
      return { phase: "loading-saved" };
    case "START_STREAMING":
      return { phase: "streaming", mode: action.mode };
    case "SHOW_SUMMARY":
      return { phase: "summary", data: action.data };
    case "SHOW_RESULTS":
      return { phase: "results", data: action.data };
  }
}

// --- Screen ---

export function ReviewScreen(): ReactElement {
  const { route, goBack } = useNavigation();

  useScope("review");

  const routeMode: CliReviewMode =
    route.screen === "review" && route.mode ? route.mode : "unstaged";
  const reviewId =
    route.screen === "review" ? route.reviewId : undefined;

  const hasReviewId = !!reviewId;

  const [state, dispatch] = useReducer(
    screenReducer,
    hasReviewId
      ? { phase: "loading-saved" as const }
      : { phase: "streaming" as const, mode: routeMode },
  );

  const backHandlerActive = state.phase === "loading-saved" || state.phase === "streaming";
  useBackHandler({ isActive: backHandlerActive });

  // Footer shortcuts depend on phase
  const footerShortcuts =
    state.phase === "loading-saved"
      ? []
      : REVIEW_SHORTCUTS;

  usePageFooter({ shortcuts: footerShortcuts });

  // Load saved review when reviewId is present
  const savedReview = useReview(reviewId ?? "");

  useEffect(() => {
    if (!hasReviewId || state.phase !== "loading-saved") return;

    if (savedReview.isLoading) return;

    if (savedReview.data) {
      const { review } = savedReview.data;
      dispatch({
        type: "SHOW_RESULTS",
        data: {
          issues: review.result.issues,
          reviewId: review.metadata.id,
          durationMs: review.metadata.durationMs ?? undefined,
        },
      });
    } else {
      // Review not found or error — start fresh
      dispatch({ type: "START_STREAMING", mode: routeMode });
    }
  }, [savedReview.isLoading, savedReview.data]);

  const handleGoToResults = () => {
    if (state.phase === "summary") {
      dispatch({ type: "SHOW_RESULTS", data: state.data });
    }
  };

  const handleBackToSummary = () => {
    if (state.phase === "results") {
      dispatch({ type: "SHOW_SUMMARY", data: state.data });
    }
  };

  switch (state.phase) {
    case "loading-saved":
      return (
        <Box justifyContent="center" alignItems="center" flexGrow={1}>
          <Spinner label="Loading review..." />
        </Box>
      );

    case "streaming":
      return <ReviewContainer mode={state.mode} reviewId={reviewId} />;

    case "summary":
      return (
        <ReviewSummaryView
          issues={state.data.issues}
          reviewId={state.data.reviewId}
          durationMs={state.data.durationMs}
          onContinue={handleGoToResults}
          onBack={goBack}
        />
      );

    case "results":
      return (
        <ReviewResultsView
          issues={state.data.issues}
          onBack={handleBackToSummary}
        />
      );

  }
}
