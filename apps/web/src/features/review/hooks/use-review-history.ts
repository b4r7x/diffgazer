import { useState, useEffect, useCallback } from "react";
import { getReviewHistory, getReview, deleteReview as apiDeleteReview } from "../api/review-history-api";
import type { SavedReview, ReviewHistoryMetadata } from "@repo/schemas";

export function useReviewHistory() {
  const [reviews, setReviews] = useState<ReviewHistoryMetadata[]>([]);
  const [currentReview, setCurrentReview] = useState<SavedReview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getReviewHistory();
      setReviews(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch review history");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadReview = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getReview(id);
      setCurrentReview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load review");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeReview = useCallback(async (id: string) => {
      try {
          await apiDeleteReview(id);
          // Optimistic update
          setReviews(prev => prev.filter(r => r.id !== id));
          if (currentReview?.id === id) {
              setCurrentReview(null);
          }
      } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to delete review");
          // Re-fetch to sync state
          fetchReviews();
      }
  }, [currentReview, fetchReviews]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  return {
    reviews,
    currentReview,
    isLoading,
    error,
    refresh: fetchReviews,
    loadReview,
    removeReview,
    clearCurrentReview: () => setCurrentReview(null)
  };
}
