import { useState, useEffect, useCallback } from "react";
import { getReviews, deleteReview as apiDeleteReview } from "../api";
import type { TriageReviewMetadata } from "@repo/schemas/triage-storage";

export function useReviews(projectPath?: string) {
  const [reviews, setReviews] = useState<TriageReviewMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getReviews(projectPath);
      setReviews(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch reviews");
    } finally {
      setIsLoading(false);
    }
  }, [projectPath]);

  const deleteReview = useCallback(
    async (id: string) => {
      try {
        await apiDeleteReview(id);
        setReviews((prev) => prev.filter((r) => r.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete review");
        fetchReviews();
      }
    },
    [fetchReviews]
  );

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  return {
    reviews,
    isLoading,
    error,
    refresh: fetchReviews,
    deleteReview,
  };
}
