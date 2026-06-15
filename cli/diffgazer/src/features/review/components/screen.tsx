import { isApiError } from "@diffgazer/core/api";
import { useReview } from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import { usePageFooter } from "@diffgazer/core/footer";
import {
  type ReviewScreenPhase,
  resolveSavedReviewOutcome,
  type SavedReviewData,
  type SavedReviewQueryState,
} from "@diffgazer/core/review";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { Box } from "ink";
import { type ReactElement, useState } from "react";
import { Button } from "../../../components/ui/button.js";
import { Callout } from "../../../components/ui/callout.js";
import { Spinner } from "../../../components/ui/spinner.js";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useNavigation } from "../../../hooks/use-navigation";
import { ReviewContainer } from "./container.js";
import { ReviewResultsView } from "./results-view.js";
import { ReviewSummaryView } from "./summary-view.js";

interface SavedReviewViewProps {
  saved: SavedReviewData;
  onClose: () => void;
}

function SavedReviewView({ saved, onClose }: SavedReviewViewProps): ReactElement {
  const [phase, setPhase] = useState<Extract<ReviewScreenPhase, "summary" | "results">>("summary");

  if (phase === "summary") {
    return (
      <ReviewSummaryView
        issues={saved.issues}
        reviewId={saved.reviewId}
        durationMs={saved.durationMs}
        lensStats={saved.lensStats}
        droppedBelowThreshold={saved.droppedBelowThreshold}
        minSeverity={saved.minSeverity}
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

function SavedReviewErrorView({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
}): ReactElement {
  useBackHandler({ isActive: true });
  usePageFooter({ shortcuts: [] });

  return (
    <Box flexDirection="column" gap={1}>
      <Callout variant="error">
        <Callout.Title>Could not load review</Callout.Title>
        <Callout.Content>{message}</Callout.Content>
      </Callout>
      <Box gap={2}>
        <Button variant="secondary" isActive onPress={onBack}>
          Back
        </Button>
      </Box>
    </Box>
  );
}

export function ReviewScreen(): ReactElement {
  const { route, goBack } = useNavigation();

  const routeMode: ReviewMode = route.screen === "review" && route.mode ? route.mode : "unstaged";
  const reviewId = route.screen === "review" ? route.reviewId : undefined;

  const savedReview = useReview(reviewId ?? "");

  if (reviewId) {
    let status: SavedReviewQueryState["status"] = "pending";
    if (savedReview.isSuccess) {
      status = "success";
    } else if (savedReview.isError) {
      status = "error";
    }

    const outcome = resolveSavedReviewOutcome(
      {
        status,
        review: savedReview.data?.review ?? null,
        error: savedReview.error,
        notFound: isApiError(savedReview.error) && savedReview.error.status === 404,
      },
      false,
    );

    if (outcome.kind === "loading") {
      return <LoadingSavedView />;
    }
    if (outcome.kind === "results") {
      return <SavedReviewView saved={outcome.data} onClose={goBack} />;
    }
    if (outcome.kind === "report-error") {
      const message = getErrorMessage(outcome.error, "Failed to load the saved review.");
      return <SavedReviewErrorView message={message} onBack={goBack} />;
    }
  }

  return <ReviewContainer mode={routeMode} reviewId={reviewId} />;
}
