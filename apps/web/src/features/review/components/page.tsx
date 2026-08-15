import { useReview } from "@diffgazer/core/api/hooks";
import {
  type ReviewScreenPhase,
  resolveSavedReviewOutcome,
  toSavedReviewQueryState,
} from "@diffgazer/core/review";
import { toast } from "@diffgazer/ui/components/toast";
import {
  useCanGoBack,
  useLocation,
  useNavigate,
  useParams,
  useRouter,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { performBackAction, resolveBackAction } from "@/lib/back-navigation";
import { useReviewErrorHandler } from "../hooks/use-error-handler";
import { type ReviewCompleteData, ReviewContainer, ReviewLoadingMessage } from "./container";
import { ReviewResultsView } from "./results-view";
import { ReviewSummaryView } from "./summary-view";

type ReviewData = ReviewCompleteData;

type LiveReviewState =
  | { phase: Extract<ReviewScreenPhase, "streaming">; reviewId: string }
  | { phase: Extract<ReviewScreenPhase, "summary" | "results">; reviewData: ReviewData };

const REVIEW_ROUTE = "/review/{-$reviewId}" as const;

/**
 * The `issueId` search param is user-editable shared state, so a deep link is
 * honored only when it names an issue this review actually produced. Both the
 * saved and the live results branch resolve it here so neither can skip the guard.
 */
function resolveValidIssueId(
  issues: readonly { id: string }[],
  issueId: string | null,
): string | null {
  if (!issueId) return null;
  return issues.some((issue) => issue.id === issueId) ? issueId : null;
}

function getLiveReviewId(state: LiveReviewState | null): string | null {
  if (!state) return null;
  if (state.phase === "streaming") return state.reviewId;
  return state.reviewData.reviewId;
}

export function ReviewPage() {
  const params = useParams({ from: REVIEW_ROUTE });
  const search = useSearch({ from: REVIEW_ROUTE });
  const reviewMode = search.mode;
  const isLiveNavigation = search.live === true;
  const initialIssueId = search.issueId ?? null;
  const reviewId = params.reviewId ?? null;
  const [liveState, setLiveState] = useState<LiveReviewState | null>(
    reviewId && isLiveNavigation ? { phase: "streaming", reviewId } : null,
  );
  const [streamNotFound, setStreamNotFound] = useState(false);
  const [savedResultsOpen, setSavedResultsOpen] = useState(false);
  const notFoundReportedRef = useRef<string | null>(null);
  const reportErrorReportedRef = useRef<string | null>(null);

  // Reset the screen state when the route's review identity changes, during
  // render (no derived-state effect): a new reviewId/live navigation starts a
  // fresh streaming/idle screen rather than reusing the previous review's state.
  const [routeKey, setRouteKey] = useState(`${reviewId ?? ""}:${isLiveNavigation}`);
  const nextRouteKey = `${reviewId ?? ""}:${isLiveNavigation}`;
  if (routeKey !== nextRouteKey) {
    setRouteKey(nextRouteKey);
    setLiveState(reviewId && isLiveNavigation ? { phase: "streaming", reviewId } : null);
    setStreamNotFound(false);
    setSavedResultsOpen(false);
  }

  const router = useRouter();
  const canGoBack = useCanGoBack();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { handleApiError } = useReviewErrorHandler();

  const liveReviewId = getLiveReviewId(liveState);
  const isLiveReviewRoute = Boolean(reviewId && liveReviewId === reviewId);
  const shouldLoadSavedReview = Boolean(reviewId && !isLiveReviewRoute && !liveState);
  const savedReviewQuery = useReview(shouldLoadSavedReview ? (reviewId ?? null) : null);
  const savedOutcome = shouldLoadSavedReview
    ? resolveSavedReviewOutcome(toSavedReviewQueryState(savedReviewQuery), streamNotFound)
    : null;
  const savedOutcomeKind = savedOutcome?.kind ?? null;
  // A saved review that ended in a failed terminal outcome carries its receipt
  // durably; the container renders it instead of a results screen with no findings.
  const savedExecution = shouldLoadSavedReview
    ? savedReviewQuery.data?.review.executionSnapshot
    : undefined;
  const failedTerminalOutcome =
    savedExecution && savedExecution.receipt.outcome !== "completed"
      ? savedExecution.receipt.outcome
      : null;
  const savedErrorForReport = savedOutcome?.kind === "report-error" ? savedOutcome.error : null;
  const allowResumeWithoutSetup =
    isLiveNavigation || (shouldLoadSavedReview && savedOutcomeKind === "fallback-to-stream");

  const handleComplete = (data: ReviewCompleteData) => {
    setLiveState({ phase: "summary", reviewData: data });
  };

  const handleStreamNotFound = () => {
    setStreamNotFound(true);
    setLiveState(null);
  };

  const handleBack = () => {
    performBackAction(router, resolveBackAction(pathname, canGoBack));
  };

  useEffect(() => {
    if (savedOutcomeKind === "report-error" && reportErrorReportedRef.current !== nextRouteKey) {
      reportErrorReportedRef.current = nextRouteKey;
      handleApiError(savedErrorForReport);
    }
  }, [nextRouteKey, savedOutcomeKind, savedErrorForReport, handleApiError]);

  useEffect(() => {
    if (savedOutcomeKind === "not-found" && notFoundReportedRef.current !== nextRouteKey) {
      notFoundReportedRef.current = nextRouteKey;
      toast.error("Review Not Found", {
        message: "The live session has expired and no saved results are available.",
      });
      navigate({ to: "/" });
    }
  }, [nextRouteKey, savedOutcomeKind, navigate]);

  if (failedTerminalOutcome && savedExecution) {
    return (
      <ReviewContainer
        terminalOutcome={failedTerminalOutcome}
        usageAvailability={savedExecution.receipt.usageAvailability}
        onBack={handleBack}
      />
    );
  }

  // `fallback-to-stream` is handled by deriving the streaming view below
  // (the live state falls back to a fresh stream), so it intentionally does
  // not short-circuit here.
  if (savedOutcome && savedOutcome.kind !== "fallback-to-stream") {
    if (savedOutcome.kind === "results") {
      const savedIssueId = resolveValidIssueId(savedOutcome.data.issues, initialIssueId);

      if (!savedResultsOpen && !savedIssueId) {
        return (
          <ReviewSummaryView
            {...savedOutcome.data}
            onEnterReview={() => setSavedResultsOpen(true)}
            onBack={handleBack}
          />
        );
      }
      return (
        <ReviewResultsView
          issues={savedOutcome.data.issues}
          reviewId={savedOutcome.data.reviewId}
          initialIssueId={savedIssueId}
          droppedDuplicates={savedOutcome.data.droppedDuplicates}
          lensStats={savedOutcome.data.lensStats}
        />
      );
    }
    return <ReviewLoadingMessage message="Loading review..." />;
  }

  if (!reviewId) {
    return <ReviewLoadingMessage message="Redirecting..." />;
  }

  const currentLiveState = liveState ?? { phase: "streaming" as const, reviewId };

  switch (currentLiveState.phase) {
    case "streaming":
      return (
        <ReviewContainer
          key={reviewId}
          mode={reviewMode}
          allowResumeWithoutSetup={allowResumeWithoutSetup}
          onComplete={handleComplete}
          onStreamNotFound={handleStreamNotFound}
        />
      );

    case "summary":
      return (
        <ReviewSummaryView
          {...currentLiveState.reviewData}
          onEnterReview={() =>
            setLiveState({ phase: "results", reviewData: currentLiveState.reviewData })
          }
          onBack={handleBack}
        />
      );

    case "results":
      return (
        <ReviewResultsView
          issues={currentLiveState.reviewData.issues}
          reviewId={currentLiveState.reviewData.reviewId}
          initialIssueId={resolveValidIssueId(currentLiveState.reviewData.issues, initialIssueId)}
          droppedDuplicates={currentLiveState.reviewData.droppedDuplicates}
          lensStats={currentLiveState.reviewData.lensStats}
        />
      );
  }
}
