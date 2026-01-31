import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { SavedTriageReview } from "@repo/schemas";

export function useExistingReview(reviewId: string | undefined) {
  const [review, setReview] = useState<SavedTriageReview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reviewId) {
      setReview(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchReview() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.get<{ review: SavedTriageReview }>(
          `/triage/reviews/${reviewId}`
        );
        if (!cancelled) {
          setReview(data.review);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch review");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchReview();

    return () => {
      cancelled = true;
    };
  }, [reviewId]);

  return { review, isLoading, error };
}
