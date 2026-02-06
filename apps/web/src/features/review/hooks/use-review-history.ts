import { useCallback, useEffect, useState } from "react";
import type { ReviewMetadata, SavedReview } from "@stargazer/schemas/review";
import { api } from "@/lib/api";

interface UseReviewHistoryReturn {
  reviews: ReviewMetadata[];
  currentReview: SavedReview | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadReview: (id: string) => Promise<void>;
  removeReview: (id: string) => Promise<void>;
  clearCurrentReview: () => void;
}

export function useReviewHistory(): UseReviewHistoryReturn {
  const [reviews, setReviews] = useState<ReviewMetadata[]>([]);
  const [currentReview, setCurrentReview] = useState<SavedReview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getReviews();
      setReviews(data.reviews);
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
      const { review } = await api.getReview(id);
      setCurrentReview(review);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load review");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeReview = useCallback(
    async (id: string) => {
      try {
        await api.deleteReview(id);
        setReviews((prev) => prev.filter((review) => review.id !== id));
        if (currentReview?.metadata?.id === id) {
          setCurrentReview(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete review");
        fetchReviews();
      }
    },
    [currentReview, fetchReviews]
  );

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
    clearCurrentReview: () => setCurrentReview(null),
  };
}
