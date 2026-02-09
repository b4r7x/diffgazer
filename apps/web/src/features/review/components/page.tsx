import { useReducer, useEffect } from "react";
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
import { usePageFooter } from "@/hooks/use-page-footer";

interface ReviewData {
  issues: ReviewIssue[];
  reviewId: string | null;
}

type ReviewState =
  | { phase: "loading-saved" }
  | { phase: "streaming" }
  | { phase: "summary"; reviewData: ReviewData }
  | { phase: "results"; reviewData: ReviewData };

type ReviewAction =
  | { type: "START_LOAD_SAVED" }
  | { type: "SHOW_STREAMING" }
  | { type: "SHOW_SUMMARY"; reviewData: ReviewData }
  | { type: "SHOW_RESULTS"; reviewData: ReviewData };

function reviewReducer(_state: ReviewState, action: ReviewAction): ReviewState {
  switch (action.type) {
    case "START_LOAD_SAVED":
      return { phase: "loading-saved" };
    case "SHOW_STREAMING":
      return { phase: "streaming" };
    case "SHOW_SUMMARY":
      return { phase: "summary", reviewData: action.reviewData };
    case "SHOW_RESULTS":
      return { phase: "results", reviewData: action.reviewData };
  }
}

const loadingMessageMap: Record<ReviewState["phase"], string | null> = {
  "loading-saved": "Loading review...",
  streaming: null,
  summary: null,
  results: null,
};

function LoadingReviewState({ message }: { message: string }) {
  usePageFooter({ shortcuts: [] });

  return (
    <div className="flex flex-1 items-center justify-center">
      <div
        className="text-tui-muted font-mono text-sm"
        role="status"
        aria-live="polite"
      >
        {message}
      </div>
    </div>
  );
}

export function ReviewPage() {
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const reviewMode = search.mode ?? "unstaged";

  const hasReviewId = !!params.reviewId;
  const [state, dispatch] = useReducer(
    reviewReducer,
    hasReviewId ? { phase: "loading-saved" as const } : { phase: "streaming" as const },
  );

  const router = useRouter();
  const { handleApiError } = useReviewErrorHandler();

  const startFreshReview = async () => {
    await router.navigate({
      to: "/review",
      search: { mode: reviewMode },
      replace: true,
    });
    dispatch({ type: "SHOW_STREAMING" });
  };

  const loadSavedOrFresh = async (reviewId: string) => {
    try {
      const { review } = await api.getReview(reviewId);
      if (review?.result) {
        dispatch({
          type: "SHOW_RESULTS",
          reviewData: { issues: review.result.issues, reviewId: review.metadata.id },
        });
        return;
      }
    } catch (error) {
      if (!isApiError(error) || error.status !== 404) {
        handleApiError(error);
        return;
      }
    }
    await startFreshReview();
  };

  const handleComplete = (data: ReviewCompleteData) => {
    dispatch({ type: "SHOW_SUMMARY", reviewData: data });
  };

  const handleReviewNotInSession = (reviewId: string) => {
    dispatch({ type: "START_LOAD_SAVED" });
    void loadSavedOrFresh(reviewId);
  };

  useEffect(() => {
    if (state.phase !== "loading-saved" || !params.reviewId) return;
    void loadSavedOrFresh(params.reviewId);
  }, []);

  const loadingMessage = loadingMessageMap[state.phase];

  if (loadingMessage) {
    return <LoadingReviewState message={loadingMessage} />;
  }

  switch (state.phase) {
    case "streaming":
      return (
        <ReviewContainer
          mode={reviewMode}
          onComplete={handleComplete}
          onReviewNotInSession={handleReviewNotInSession}
        />
      );

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
