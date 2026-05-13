import { useEffect, useState } from "react";
import {
  useParams,
  useRouter,
  useSearch,
} from "@tanstack/react-router";
import { ReviewContainer, ReviewLoadingMessage, type ReviewCompleteData } from "./review-container";
import { ReviewSummaryView } from "./review-summary-view";
import { ReviewResultsView } from "./review-results-view";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { isApiError, useReviewErrorHandler } from "../hooks";
import { useReview } from "@diffgazer/core/api/hooks";

interface ReviewData {
  issues: ReviewIssue[];
  reviewId: string | null;
}

type LiveReviewState =
  | { phase: "streaming"; reviewId: string | null }
  | { phase: "summary"; reviewData: ReviewData }
  | { phase: "results"; reviewData: ReviewData };

const REVIEW_ROUTE = "/review/{-$reviewId}" as const;

function logReviewPage(event: string, data: Record<string, unknown> = {}) {
  console.log(`[diffgazer:review-page] ${event}`, {
    at: new Date().toISOString(),
    path: window.location.pathname,
    ...data,
  });
}

function getLiveReviewId(liveState: LiveReviewState | null) {
  switch (liveState?.phase) {
    case "streaming":
      return liveState.reviewId;
    case "summary":
    case "results":
      return liveState.reviewData.reviewId;
    default:
      return null;
  }
}

export function ReviewPage() {
  const params = useParams({ from: REVIEW_ROUTE });
  const search = useSearch({ from: REVIEW_ROUTE });
  const reviewMode = search.mode;
  const reviewId = params.reviewId ?? null;
  const [liveState, setLiveState] = useState<LiveReviewState | null>(null);

  const router = useRouter();
  const { handleApiError } = useReviewErrorHandler();

  const liveReviewId = getLiveReviewId(liveState);
  const isLiveReviewRoute = Boolean(reviewId && liveReviewId === reviewId);
  const isLiveReviewStreaming = liveState?.phase === "streaming";
  const shouldLoadSavedReview = Boolean(
    reviewId &&
    !isLiveReviewRoute &&
    !isLiveReviewStreaming,
  );
  const savedReviewQuery = useReview(shouldLoadSavedReview ? (reviewId ?? "") : "");
  const savedReview = savedReviewQuery.data?.review;
  const savedReviewData: ReviewData | null = savedReview?.result
    ? { issues: savedReview.result.issues, reviewId: savedReview.metadata.id }
    : null;

  const handleComplete = (data: ReviewCompleteData) => {
    logReviewPage("handleComplete", {
      reviewId: data.reviewId,
      issues: data.issues.length,
    });
    setLiveState({ phase: "summary", reviewData: data });
  };

  useEffect(() => {
    logReviewPage("route decision", {
      routeReviewId: reviewId,
      liveReviewId,
      livePhase: liveState?.phase,
      isLiveReviewRoute,
      isLiveReviewStreaming,
      shouldLoadSavedReview,
      savedReviewIsSuccess: savedReviewQuery.isSuccess,
      savedReviewIsError: savedReviewQuery.isError,
      savedReviewError: savedReviewQuery.error instanceof Error ? savedReviewQuery.error.message : savedReviewQuery.error,
    });

    if (!shouldLoadSavedReview || !reviewId) return;

    const startFreshReview = () => {
      logReviewPage("startFreshReview fallback", {
        routeReviewId: reviewId,
        mode: reviewMode,
        savedReviewIsSuccess: savedReviewQuery.isSuccess,
        savedReviewIsError: savedReviewQuery.isError,
        savedReviewError: savedReviewQuery.error instanceof Error ? savedReviewQuery.error.message : savedReviewQuery.error,
      });
      setLiveState({ phase: "streaming", reviewId: null });
      void router.navigate({
        to: "/review/{-$reviewId}",
        params: {},
        search: { mode: reviewMode },
        replace: true,
      });
    };

    if (savedReviewQuery.isSuccess && !savedReviewQuery.data.review?.result) {
      startFreshReview();
      return;
    }

    if (!savedReviewQuery.isError) return;

    if (isApiError(savedReviewQuery.error) && savedReviewQuery.error.status === 404) {
      startFreshReview();
      return;
    }

    handleApiError(savedReviewQuery.error);
  }, [
    handleApiError,
    reviewId,
    savedReviewQuery.data,
    savedReviewQuery.error,
    savedReviewQuery.isError,
    savedReviewQuery.isSuccess,
    shouldLoadSavedReview,
    reviewMode,
    router,
  ]);

  if (shouldLoadSavedReview) {
    if (savedReviewData) {
      return (
        <ReviewResultsView
          issues={savedReviewData.issues}
          reviewId={savedReviewData.reviewId}
        />
      );
    }

    return <ReviewLoadingMessage message="Loading review..." />;
  }

  const currentLiveState = liveState ?? { phase: "streaming" as const, reviewId: null };
  const handleReviewIdChange = (nextReviewId: string) => {
    logReviewPage("handleReviewIdChange", {
      nextReviewId,
      currentPhase: liveState?.phase,
      currentLiveReviewId: liveReviewId,
      routeReviewId: reviewId,
    });
    setLiveState((current) => {
      if (current?.phase === "streaming" && current.reviewId === nextReviewId) {
        return current;
      }
      if (current && current.phase !== "streaming") {
        return current;
      }
      return { phase: "streaming", reviewId: nextReviewId };
    });
  };

  switch (currentLiveState.phase) {
    case "streaming":
      return (
        <ReviewContainer
          mode={reviewMode}
          onComplete={handleComplete}
          onReviewIdChange={handleReviewIdChange}
        />
      );

    case "summary":
      return (
        <ReviewSummaryView
          issues={currentLiveState.reviewData.issues}
          reviewId={currentLiveState.reviewData.reviewId}
          onEnterReview={() =>
            setLiveState({ phase: "results", reviewData: currentLiveState.reviewData })
          }
          onBack={() => router.history.back()}
        />
      );

    case "results":
      return (
        <ReviewResultsView
          issues={currentLiveState.reviewData.issues}
          reviewId={currentLiveState.reviewData.reviewId}
        />
      );
  }
}
