import { useReview } from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import { usePageFooter } from "@diffgazer/core/footer";
import {
  type ReviewScreenPhase,
  resolveSavedReviewOutcome,
  type SavedReviewData,
  toSavedReviewQueryState,
} from "@diffgazer/core/review";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { Box } from "ink";
import { type ReactElement, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Callout } from "../../../components/ui/callout";
import { Spinner } from "../../../components/ui/spinner";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useNavigation } from "../../../hooks/use-navigation";
import { ReviewContainer } from "./container";
import { ReviewResultsView } from "./results-view";
import { ReviewSummaryView } from "./summary-view";

interface SavedReviewViewProps {
  saved: SavedReviewData;
  initialIssueId?: string;
  onClose: () => void;
}

function SavedReviewView({ saved, initialIssueId, onClose }: SavedReviewViewProps): ReactElement {
  const hasInitialIssue = saved.issues.some((issue) => issue.id === initialIssueId);
  const [phase, setPhase] = useState<Extract<ReviewScreenPhase, "summary" | "results">>(
    hasInitialIssue ? "results" : "summary",
  );

  if (phase === "summary") {
    return (
      <ReviewSummaryView
        issues={saved.issues}
        reviewId={saved.reviewId}
        durationMs={saved.durationMs}
        lensStats={saved.lensStats}
        droppedDuplicates={saved.droppedDuplicates}
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
      initialIssueId={hasInitialIssue ? initialIssueId : undefined}
      droppedDuplicates={saved.droppedDuplicates}
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
  usePageFooter({ shortcuts: [], rightShortcuts: [{ key: "Esc", label: "Back" }] });

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
  const issueId = route.screen === "review" ? route.issueId : undefined;
  const isLiveRoute = route.screen === "review" && route.live === true;

  const shouldLoadSavedReview = Boolean(reviewId && !isLiveRoute);
  const savedReview = useReview(shouldLoadSavedReview ? (reviewId ?? "") : "");

  if (reviewId && shouldLoadSavedReview) {
    const outcome = resolveSavedReviewOutcome(toSavedReviewQueryState(savedReview), false);

    if (outcome.kind === "loading") {
      return <LoadingSavedView />;
    }
    if (outcome.kind === "results") {
      return (
        <SavedReviewView
          key={`${outcome.data.reviewId}:${issueId ?? "summary"}`}
          saved={outcome.data}
          initialIssueId={issueId}
          onClose={goBack}
        />
      );
    }
    if (outcome.kind === "report-error") {
      const message = getErrorMessage(outcome.error, "Failed to load the saved review.");
      return <SavedReviewErrorView message={message} onBack={goBack} />;
    }
  }

  return (
    <ReviewContainer mode={routeMode} reviewId={reviewId} allowResumeWithoutSetup={isLiveRoute} />
  );
}
