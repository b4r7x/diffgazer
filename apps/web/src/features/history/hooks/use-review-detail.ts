import { useState, useEffect } from "react";
import { getTriageReview } from "@repo/api";
import { api } from "@/lib/api";
import type { SavedTriageReview } from "@repo/schemas/triage-storage";

export function useReviewDetail(reviewId: string | null) {
  const [review, setReview] = useState<SavedTriageReview | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!reviewId) {
      setReview(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    getTriageReview(api, reviewId)
      .then(({ review }) => {
        if (!cancelled) setReview(review);
      })
      .catch(() => {
        if (!cancelled) setReview(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reviewId]);

  return { review, isLoading };
}
