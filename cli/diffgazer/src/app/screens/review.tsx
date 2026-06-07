import { useReview } from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { Box } from "ink";
import { type ReactElement, useState } from "react";
import { Spinner } from "../../components/ui/spinner";
import { ReviewContainer } from "../../features/review/components/container";
import { ReviewResultsView } from "../../features/review/components/results-view";
import { ReviewSummaryView } from "../../features/review/components/summary-view";
import { useBackHandler } from "../../hooks/use-back-handler";
import { useScope } from "../../hooks/use-scope";
import { useNavigation } from "../providers/navigation-provider";
import { type SavedReviewData, selectReviewScreenPhase } from "./review-phase";

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

  const routeMode: ReviewMode = route.screen === "review" && route.mode ? route.mode : "unstaged";
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
