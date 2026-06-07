import { isApiError } from "@diffgazer/core/api";
import { useReview } from "@diffgazer/core/api/hooks";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { toast } from "@diffgazer/ui/components/toast";
import { useNavigate, useParams, useRouter, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useReviewErrorHandler } from "../hooks/use-error-handler";
import { type ReviewCompleteData, ReviewContainer, ReviewLoadingMessage } from "./container";
import { ReviewResultsView } from "./results-view";
import { ReviewSummaryView } from "./summary-view";

interface ReviewData {
  issues: ReviewIssue[];
  reviewId: string | null;
}

type LiveReviewState =
  | { phase: "streaming"; reviewId: string }
  | { phase: "summary"; reviewData: ReviewData }
  | { phase: "results"; reviewData: ReviewData };

type SavedReviewOutcome =
  | { kind: "results"; data: ReviewData }
  | { kind: "fallback-to-stream" }
  | { kind: "report-error"; error: unknown }
  | { kind: "loading" }
  | { kind: "not-found" };

const REVIEW_ROUTE = "/review/{-$reviewId}" as const;

function getLiveReviewId(state: LiveReviewState | null): string | null {
  if (!state) return null;
  if (state.phase === "streaming") return state.reviewId;
  return state.reviewData.reviewId;
}

function getSavedReviewOutcome(
  savedReviewQuery: ReturnType<typeof useReview>,
  streamNotFound: boolean,
): SavedReviewOutcome {
  if (savedReviewQuery.isSuccess) {
    const savedReview = savedReviewQuery.data?.review;
    if (savedReview?.result) {
      return {
        kind: "results",
        data: { issues: savedReview.result.issues, reviewId: savedReview.metadata.id },
      };
    }
    // Saved review exists but has no result. If we already tried the stream
    // and it 404'd, there is nothing to show -- report not-found instead of
    // looping back to the dead stream.
    if (streamNotFound) return { kind: "not-found" };
    return { kind: "fallback-to-stream" };
  }

  if (savedReviewQuery.isError) {
    if (isApiError(savedReviewQuery.error) && savedReviewQuery.error.status === 404) {
      // Same loop guard: stream already 404'd, saved also 404'd.
      if (streamNotFound) return { kind: "not-found" };
      return { kind: "fallback-to-stream" };
    }
    return { kind: "report-error", error: savedReviewQuery.error };
  }

  return { kind: "loading" };
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

  const router = useRouter();
  const navigate = useNavigate();
  const { handleApiError } = useReviewErrorHandler();

  const liveReviewId = getLiveReviewId(liveState);
  const isLiveReviewRoute = Boolean(reviewId && liveReviewId === reviewId);
  const shouldLoadSavedReview = Boolean(reviewId && !isLiveReviewRoute && !liveState);
  const savedReviewQuery = useReview(shouldLoadSavedReview ? (reviewId ?? "") : "");
  const savedOutcome = shouldLoadSavedReview
    ? getSavedReviewOutcome(savedReviewQuery, streamNotFound)
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

  useEffect(() => {
    if (savedOutcomeKind === "report-error") {
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
          onStreamNotFound={handleStreamNotFound}
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
          initialIssueId={initialIssueId}
        />
      );
  }
}
