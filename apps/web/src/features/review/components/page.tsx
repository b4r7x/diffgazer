import { isApiError } from "@diffgazer/core/api";
import { useReview } from "@diffgazer/core/api/hooks";
import {
  type ReviewScreenPhase,
  resolveSavedReviewOutcome,
  type SavedReviewQueryState,
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
import { resolveBackAction } from "@/lib/back-navigation";
import { useReviewErrorHandler } from "../hooks/use-error-handler";
import { type ReviewCompleteData, ReviewContainer, ReviewLoadingMessage } from "./container";
import { ReviewResultsView } from "./results-view";
import { ReviewSummaryView } from "./summary-view";

type ReviewData = ReviewCompleteData;

type LiveReviewState =
  | { phase: Extract<ReviewScreenPhase, "streaming">; reviewId: string }
  | { phase: Extract<ReviewScreenPhase, "summary" | "results">; reviewData: ReviewData };

const REVIEW_ROUTE = "/review/{-$reviewId}" as const;

function getLiveReviewId(state: LiveReviewState | null): string | null {
  if (!state) return null;
  if (state.phase === "streaming") return state.reviewId;
  return state.reviewData.reviewId;
}

function toSavedReviewQueryState(
  savedReviewQuery: ReturnType<typeof useReview>,
): SavedReviewQueryState {
  let status: SavedReviewQueryState["status"] = "pending";
  if (savedReviewQuery.isSuccess) {
    status = "success";
  } else if (savedReviewQuery.isError) {
    status = "error";
  }

  return {
    status,
    review: savedReviewQuery.data?.review ?? null,
    error: savedReviewQuery.error,
    notFound: isApiError(savedReviewQuery.error) && savedReviewQuery.error.status === 404,
  };
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
  const notFoundReportedRef = useRef(false);
  const reportErrorReportedRef = useRef(false);

  // Reset the screen state when the route's review identity changes, during
  // render (no derived-state effect): a new reviewId/live navigation starts a
  // fresh streaming/idle screen rather than reusing the previous review's state.
  const [routeKey, setRouteKey] = useState(`${reviewId ?? ""}:${isLiveNavigation}`);
  const nextRouteKey = `${reviewId ?? ""}:${isLiveNavigation}`;
  if (routeKey !== nextRouteKey) {
    setRouteKey(nextRouteKey);
    setLiveState(reviewId && isLiveNavigation ? { phase: "streaming", reviewId } : null);
    setStreamNotFound(false);
    notFoundReportedRef.current = false;
    reportErrorReportedRef.current = false;
  }

  const router = useRouter();
  const canGoBack = useCanGoBack();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { handleApiError } = useReviewErrorHandler();

  const liveReviewId = getLiveReviewId(liveState);
  const isLiveReviewRoute = Boolean(reviewId && liveReviewId === reviewId);
  const shouldLoadSavedReview = Boolean(reviewId && !isLiveReviewRoute && !liveState);
  const savedReviewQuery = useReview(shouldLoadSavedReview ? (reviewId ?? "") : "");
  const savedOutcome = shouldLoadSavedReview
    ? resolveSavedReviewOutcome(toSavedReviewQueryState(savedReviewQuery), streamNotFound)
    : null;
  const savedOutcomeKind = savedOutcome?.kind ?? null;
  const savedErrorForReport = savedOutcome?.kind === "report-error" ? savedOutcome.error : null;

  const handleComplete = (data: ReviewCompleteData) => {
    setLiveState({ phase: "summary", reviewData: data });
  };

  const handleStreamNotFound = () => {
    setStreamNotFound(true);
    setLiveState(null);
  };

  const handleBack = () => {
    const action = resolveBackAction(pathname, canGoBack);
    if (action.type === "navigate") {
      void router.navigate({ to: action.to });
      return;
    }
    if (action.type === "history") {
      router.history.back();
    }
  };

  useEffect(() => {
    if (savedOutcomeKind === "report-error" && !reportErrorReportedRef.current) {
      reportErrorReportedRef.current = true;
      handleApiError(savedErrorForReport);
    }
  }, [savedOutcomeKind, savedErrorForReport, handleApiError]);

  useEffect(() => {
    if (savedOutcomeKind === "not-found" && !notFoundReportedRef.current) {
      notFoundReportedRef.current = true;
      toast.error("Review Not Found", {
        message: "The live session has expired and no saved results are available.",
      });
      navigate({ to: "/" });
    }
  }, [savedOutcomeKind, navigate]);

  // `fallback-to-stream` is handled by deriving the streaming view below
  // (the live state falls back to a fresh stream), so it intentionally does
  // not short-circuit here.
  if (savedOutcome && savedOutcome.kind !== "fallback-to-stream") {
    if (savedOutcome.kind === "results") {
      return (
        <ReviewResultsView
          issues={savedOutcome.data.issues}
          reviewId={savedOutcome.data.reviewId}
          initialIssueId={initialIssueId}
          droppedDuplicates={savedOutcome.data.droppedDuplicates}
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
          onComplete={handleComplete}
          onStreamNotFound={handleStreamNotFound}
        />
      );

    case "summary":
      return (
        <ReviewSummaryView
          issues={currentLiveState.reviewData.issues}
          reviewId={currentLiveState.reviewData.reviewId}
          lensStats={currentLiveState.reviewData.lensStats}
          droppedDuplicates={currentLiveState.reviewData.droppedDuplicates}
          droppedBelowThreshold={currentLiveState.reviewData.droppedBelowThreshold}
          minSeverity={currentLiveState.reviewData.minSeverity}
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
          initialIssueId={initialIssueId}
          droppedDuplicates={currentLiveState.reviewData.droppedDuplicates}
        />
      );
  }
}
