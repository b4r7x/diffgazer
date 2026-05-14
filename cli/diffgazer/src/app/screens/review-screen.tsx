import { useState, type ReactElement } from "react";
import { Box } from "ink";
import { useNavigation } from "../navigation-context.js";
import { useScope } from "../../hooks/use-scope.js";
import { useBackHandler } from "../../hooks/use-back-handler.js";
import { useReview } from "@diffgazer/core/api/hooks";
import { ReviewContainer } from "../../features/review/components/review-container.js";
import { ReviewResultsView } from "../../features/review/components/review-results-view.js";
import { ReviewSummaryView } from "../../features/review/components/review-summary-view.js";
import { Spinner } from "../../components/ui/spinner.js";
import { usePageFooter } from "@diffgazer/core/footer";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import {
  selectReviewScreenPhase,
  type SavedReviewData,
} from "./review-screen-phase.js";

interface SavedReviewViewProps {
  saved: SavedReviewData;
  onClose: () => void;
}

function SavedReviewView({ saved, onClose }: SavedReviewViewProps): ReactElement {
  const [phase, setPhase] = useState<"summary" | "results">("summary");

  if (phase === "summary") {
    return (
      <ReviewSummaryView
        issues={saved.issues}
        reviewId={saved.reviewId}
        durationMs={saved.durationMs}
        onContinue={() => setPhase("results")}
        onBack={onClose}
      />
    );
  }

  return (
    <ReviewResultsView
      issues={saved.issues}
      reviewId={saved.reviewId}
      onBack={() => setPhase("summary")}
    />
  );
}

function LoadingSavedView(): ReactElement {
  useBackHandler({ isActive: true });
  usePageFooter({ shortcuts: [] });

  return (
    <Box justifyContent="center" alignItems="center" flexGrow={1}>
      <Spinner label="Loading review..." />
    </Box>
  );
}

export function ReviewScreen(): ReactElement {
  const { route, goBack } = useNavigation();

  useScope("review");

  const routeMode: ReviewMode =
    route.screen === "review" && route.mode ? route.mode : "unstaged";
  const reviewId = route.screen === "review" ? route.reviewId : undefined;

  const savedReview = useReview(reviewId ?? "");

  const screenPhase = selectReviewScreenPhase({
    reviewId,
    savedIsLoading: savedReview.isLoading,
    savedData: savedReview.data,
  });

  if (screenPhase.kind === "loading-saved") {
    return <LoadingSavedView />;
  }

  if (screenPhase.kind === "saved") {
    return <SavedReviewView saved={screenPhase.saved} onClose={goBack} />;
  }

  return <ReviewContainer mode={routeMode} reviewId={reviewId} />;
}
