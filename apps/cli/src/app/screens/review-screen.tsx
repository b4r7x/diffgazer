import { useEffect, useReducer, type ReactElement } from "react";
import { Box, Text, useInput } from "ink";
import { useNavigation } from "../navigation-context.js";
import { useScope } from "../../hooks/use-scope.js";
import { usePageFooter } from "../../hooks/use-page-footer.js";
import { useBackHandler } from "../../hooks/use-back-handler.js";
import { useTheme } from "../../theme/theme-context.js";
import { useReview } from "@diffgazer/api/hooks";
import { ReviewContainer } from "../../features/review/components/review-container.js";
import { ReviewResultsView } from "../../features/review/components/review-results-view.js";
import { ReviewSummaryView } from "../../features/review/components/review-summary-view.js";
import { Spinner } from "../../components/ui/spinner.js";
import { Button } from "../../components/ui/button.js";
import { SectionHeader } from "../../components/ui/section-header.js";
import { REVIEW_SHORTCUTS } from "../../config/navigation.js";
import type { ReviewIssue } from "@diffgazer/schemas/review";

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
  | { phase: "results"; data: SavedReviewData }
  | { phase: "no-changes"; mode: CliReviewMode };

type ScreenAction =
  | { type: "LOAD_SAVED" }
  | { type: "START_STREAMING"; mode: CliReviewMode }
  | { type: "SHOW_SUMMARY"; data: SavedReviewData }
  | { type: "SHOW_RESULTS"; data: SavedReviewData }
  | { type: "SHOW_NO_CHANGES"; mode: CliReviewMode };

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
    case "SHOW_NO_CHANGES":
      return { phase: "no-changes", mode: action.mode };
  }
}

// --- Screen ---

export function ReviewScreen(): ReactElement {
  const { route, navigate, goBack } = useNavigation();

  useScope("review");
  useBackHandler();

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

  // Footer shortcuts depend on phase
  const footerShortcuts =
    state.phase === "loading-saved"
      ? []
      : state.phase === "no-changes"
        ? [{ key: "Enter", label: `Review ${routeMode === "staged" ? "Unstaged" : "Staged"}` }, { key: "Esc", label: "Back" }]
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

  const handleSwitchMode = () => {
    const newMode: CliReviewMode = routeMode === "staged" ? "unstaged" : "staged";
    navigate({ screen: "review", mode: newMode });
  };

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

    case "no-changes":
      return (
        <NoChangesInline
          mode={state.mode}
          onBack={goBack}
          onSwitchMode={handleSwitchMode}
        />
      );
  }
}

// --- Inline No Changes View ---

const NO_CHANGES_MESSAGES: Record<CliReviewMode, { title: string; switchLabel: string; message: string }> = {
  staged: {
    title: "No Staged Changes",
    message: "No staged changes found. Use 'git add' to stage files, or review unstaged changes instead.",
    switchLabel: "Review Unstaged",
  },
  unstaged: {
    title: "No Unstaged Changes",
    message: "No unstaged changes found. Make some edits first, or review staged changes instead.",
    switchLabel: "Review Staged",
  },
};

function NoChangesInline({
  mode,
  onBack,
  onSwitchMode,
}: {
  mode: CliReviewMode;
  onBack: () => void;
  onSwitchMode: () => void;
}): ReactElement {
  const { tokens } = useTheme();
  const { title, message, switchLabel } = NO_CHANGES_MESSAGES[mode];

  useInput((_input, key) => {
    if (key.return) {
      onSwitchMode();
    }
    if (key.escape) {
      onBack();
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <SectionHeader bordered>{title}</SectionHeader>
      <Box paddingTop={1}>
        <Text color={tokens.muted}>{message}</Text>
      </Box>
      <Box gap={2} marginTop={1}>
        <Button variant="primary" isActive onPress={onSwitchMode}>
          {switchLabel}
        </Button>
        <Button variant="secondary" onPress={onBack}>
          Back
        </Button>
      </Box>
    </Box>
  );
}
