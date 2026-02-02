import { useState, useEffect } from "react";
import type { SavedTriageReview } from "@repo/schemas/triage-storage";
import { getTriageReview } from "../../review/api/triage-api.js";

export function useReviewDetail(reviewId: string | null) {
  const [review, setReview] = useState<SavedTriageReview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reviewId) {
      setReview(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getTriageReview(reviewId)
      .then(({ review }) => {
        if (!cancelled) setReview(review);
      })
      .catch((err) => {
        if (!cancelled) {
          setReview(null);
          setError(err.message || "Failed to load review details");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [reviewId]);

  return { review, isLoading, error };
}
