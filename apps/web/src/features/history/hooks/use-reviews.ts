import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { ReviewMetadata } from "@stargazer/schemas/review";

export function useReviews(projectPath?: string) {
  const [reviews, setReviews] = useState<ReviewMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.getReviews(projectPath);
      setReviews(response.reviews);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch reviews");
    } finally {
      setIsLoading(false);
    }
  }, [projectPath]);

  const deleteReview = useCallback(
    async (id: string) => {
      try {
        await api.deleteReview(id);
        setReviews((prev) => prev.filter((r) => r.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete review");
        fetchReviews();
      }
    },
    [fetchReviews]
  );

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    api.getReviews(projectPath)
      .then((response) => {
        if (cancelled) return;
        setReviews(response.reviews);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to fetch reviews");
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectPath]);

  return {
    reviews,
    isLoading,
    error,
    refresh: fetchReviews,
    deleteReview,
  };
}
