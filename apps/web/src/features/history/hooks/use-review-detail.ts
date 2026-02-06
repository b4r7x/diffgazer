import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { SavedReview } from "@stargazer/api";

export function useReviewDetail(reviewId: string | null) {
  const [review, setReview] = useState<SavedReview | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!reviewId) {
      setReview(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    api.getReview(reviewId)
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
