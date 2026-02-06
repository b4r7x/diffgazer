import { useReducer, useEffect, useCallback } from "react";
import {
  useSearch,
  useParams,
  useRouter,
} from "@tanstack/react-router";
import { ReviewContainer, type ReviewCompleteData } from "./review-container";
import { ReviewSummaryView } from "./review-summary-view";
import { ReviewResultsView } from "./review-results-view";
import type { ReviewIssue } from "@stargazer/schemas/review";
import { isApiError, useReviewErrorHandler } from "../hooks";
import { api } from "@/lib/api";

interface ReviewData {
  issues: ReviewIssue[];
  reviewId: string | null;
}

type ReviewState =
  | { phase: "checking-status" }
  | { phase: "loading-saved" }
  | { phase: "streaming" }
  | { phase: "summary"; reviewData: ReviewData }
  | { phase: "results"; reviewData: ReviewData };

type ReviewAction =
  | { type: "START_CHECK" }
  | { type: "START_LOAD_SAVED" }
  | { type: "CHECK_DONE" }
  | { type: "SHOW_STREAMING" }
  | { type: "SHOW_SUMMARY"; reviewData: ReviewData }
  | { type: "SHOW_RESULTS"; reviewData: ReviewData };

function reviewReducer(_state: ReviewState, action: ReviewAction): ReviewState {
  switch (action.type) {
    case "START_CHECK":
      return { phase: "checking-status" };
    case "START_LOAD_SAVED":
      return { phase: "loading-saved" };
    case "CHECK_DONE":
    case "SHOW_STREAMING":
      return { phase: "streaming" };
    case "SHOW_SUMMARY":
      return { phase: "summary", reviewData: action.reviewData };
    case "SHOW_RESULTS":
      return { phase: "results", reviewData: action.reviewData };
  }
}

export function ReviewPage() {
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const reviewMode = search.mode ?? "unstaged";

  const hasReviewId = !!params.reviewId;
  const [state, dispatch] = useReducer(
    reviewReducer,
    hasReviewId ? { phase: "checking-status" as const } : { phase: "streaming" as const },
  );

  const router = useRouter();
  const { handleApiError } = useReviewErrorHandler();

  const handleResumeFailed = useCallback(
    async (reviewId: string) => {
      dispatch({ type: "START_LOAD_SAVED" });
      try {
        const { review } = await api.getReview(reviewId);
        if (!review?.result) {
          handleApiError({ status: 404, message: "Review result not available" });
          return;
        }
        dispatch({
          type: "SHOW_RESULTS",
          reviewData: { issues: review.result.issues, reviewId: review.metadata.id },
        });
      } catch (error) {
        handleApiError(error);
      }
    },
    [handleApiError],
  );

  const handleComplete = useCallback(
    (data: ReviewCompleteData) => {
      if (data.resumeFailed && data.reviewId) {
        handleResumeFailed(data.reviewId);
        return;
      }
      dispatch({ type: "SHOW_SUMMARY", reviewData: data });
    },
    [handleResumeFailed],
  );

  useEffect(() => {
    if (state.phase !== "checking-status" || !params.reviewId) return;

    const controller = new AbortController();

    const checkStatus = async () => {
      try {
        const { review } = await api.getReview(params.reviewId!);

        if (controller.signal.aborted) return;

        if (review?.result) {
          dispatch({
            type: "SHOW_RESULTS",
            reviewData: { issues: review.result.issues, reviewId: review.metadata.id },
          });
          return;
        }

        handleApiError({ status: 404, message: "Review not found" });
      } catch (error) {
        if (controller.signal.aborted) return;

        if (isApiError(error) && error.status === 404) {
          dispatch({ type: "CHECK_DONE" });
          return;
        }

        handleApiError(error);
      }
    };

    checkStatus();

    return () => controller.abort();
  }, [state.phase, params.reviewId, handleApiError]);

  const loadingMessage =
    state.phase === "checking-status" ? "Checking review..." :
    state.phase === "loading-saved" ? "Loading review..." :
    null;

  if (loadingMessage) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div
          className="text-gray-500 font-mono text-sm"
          role="status"
          aria-live="polite"
        >
          {loadingMessage}
        </div>
      </div>
    );
  }

  switch (state.phase) {
    case "streaming":
      return <ReviewContainer mode={reviewMode} onComplete={handleComplete} />;

    case "summary":
      return (
        <ReviewSummaryView
          issues={state.reviewData.issues}
          reviewId={state.reviewData.reviewId}
          onEnterReview={() =>
            dispatch({ type: "SHOW_RESULTS", reviewData: state.reviewData })
          }
          onBack={() => router.history.back()}
        />
      );

    case "results":
      return (
        <ReviewResultsView
          issues={state.reviewData.issues}
          reviewId={state.reviewData.reviewId}
        />
      );
  }
}
