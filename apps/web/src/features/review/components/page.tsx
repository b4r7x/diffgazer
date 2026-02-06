import { useState, useEffect, useCallback, useRef } from "react";
import {
  useSearch,
  useParams,
  useRouter,
} from "@tanstack/react-router";
import { ReviewContainer, type ReviewCompleteData } from "./review-container";
import { ReviewSummaryView } from "./review-summary-view";
import { ReviewResultsView } from "./review-results-view";
import type { ReviewIssue, ReviewResult, ReviewMode } from "@stargazer/schemas/review";
import { useReviewErrorHandler } from "../hooks";
import { api } from "@/lib/api";

type ReviewView = "progress" | "summary" | "results";

interface ReviewData {
  issues: ReviewIssue[];
  reviewId: string | null;
}

export function ReviewPage() {
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const reviewMode: ReviewMode = (search as { mode?: ReviewMode }).mode ?? "unstaged";
  const [view, setView] = useState<ReviewView>("progress");
  const [reviewData, setReviewData] = useState<ReviewData>({
    issues: [],
    reviewId: null,
  });
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(!!params.reviewId);
  const [statusCheckDone, setStatusCheckDone] = useState(false);
  const initialReviewIdRef = useRef(params.reviewId);
  const router = useRouter();
  const { handleApiError } = useReviewErrorHandler();

  const handleResumeFailed = useCallback(
    async (reviewId: string) => {
      setIsLoadingSaved(true);
      try {
        const { review } = await api.getReview(reviewId);
        if (!review?.result) {
          handleApiError({ status: 404, message: "Review result not available" });
          return;
        }
        const result = review.result as ReviewResult;
        setReviewData({
          issues: result.issues,
          reviewId: review.metadata.id,
        });
        setView("results");
      } catch (error) {
        handleApiError(error);
      } finally {
        setIsLoadingSaved(false);
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
      setReviewData(data);
      setView("summary");
    },
    [handleResumeFailed],
  );

  useEffect(() => {
    if (!initialReviewIdRef.current || !params.reviewId || statusCheckDone)
      return;

    const controller = new AbortController();

    const checkStatus = async () => {
      setIsCheckingStatus(true);
      try {
        const { review } = await api.getReview(params.reviewId!);

        if (controller.signal.aborted) return;

        if (review?.result) {
          const result = review.result as ReviewResult;
          setReviewData({
            issues: result.issues,
            reviewId: review.metadata.id,
          });
          setView("results");
          setStatusCheckDone(true);
          setIsCheckingStatus(false);
          return;
        }

        handleApiError({ status: 404, message: "Review not found" });
      } catch (error) {
        if (controller.signal.aborted) return;

        if (typeof error === 'object' && error !== null && 'status' in error && (error as { status: number }).status === 404) {
          setStatusCheckDone(true);
          return;
        }

        handleApiError(error);
      } finally {
        setIsCheckingStatus(false);
      }
    };

    checkStatus();

    return () => controller.abort();
  }, [params.reviewId, statusCheckDone, handleApiError]);

  if (view === "progress") {
    if (isLoadingSaved || isCheckingStatus) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <div
            className="text-gray-500 font-mono text-sm"
            role="status"
            aria-live="polite"
          >
            {isCheckingStatus ? "Checking review..." : "Loading review..."}
          </div>
        </div>
      );
    }
    return <ReviewContainer mode={reviewMode} onComplete={handleComplete} />;
  }

  if (view === "summary") {
    return (
      <ReviewSummaryView
        issues={reviewData.issues}
        reviewId={reviewData.reviewId}
        onEnterReview={() => setView("results")}
        onBack={() => router.history.back()}
      />
    );
  }

  return (
    <ReviewResultsView
      issues={reviewData.issues}
      reviewId={reviewData.reviewId}
    />
  );
}
