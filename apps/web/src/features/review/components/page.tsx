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
  | { phase: "streaming"; reviewId: string }
  | { phase: "summary"; reviewData: ReviewData }
  | { phase: "results"; reviewData: ReviewData };

const REVIEW_ROUTE = "/review/{-$reviewId}" as const;

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
  const reviewId = params.reviewId ?? null;
  const [liveState, setLiveState] = useState<LiveReviewState | null>(
    reviewId && isLiveNavigation ? { phase: "streaming", reviewId } : null,
  );

  const router = useRouter();
  const { handleApiError } = useReviewErrorHandler();

  const liveReviewId = getLiveReviewId(liveState);
  const isLiveReviewRoute = Boolean(reviewId && liveReviewId === reviewId);
  const shouldLoadSavedReview = Boolean(
    reviewId &&
    !isLiveReviewRoute &&
    !liveState,
  );
  const savedReviewQuery = useReview(shouldLoadSavedReview ? (reviewId ?? "") : "");
  const savedReview = savedReviewQuery.data?.review;
  const savedReviewData: ReviewData | null = savedReview?.result
    ? { issues: savedReview.result.issues, reviewId: savedReview.metadata.id }
    : null;

  const handleComplete = (data: ReviewCompleteData) => {
    setLiveState({ phase: "summary", reviewData: data });
  };

  useEffect(() => {
    if (!shouldLoadSavedReview || !reviewId) return;

    const startFreshReview = () => {
      setLiveState({ phase: "streaming", reviewId });
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

  if (!reviewId) {
    return <ReviewLoadingMessage message="Redirecting..." />;
  }

  const currentLiveState = liveState ?? { phase: "streaming" as const, reviewId };

  switch (currentLiveState.phase) {
    case "streaming":
      return (
        <ReviewContainer
          mode={reviewMode}
          onComplete={handleComplete}
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
