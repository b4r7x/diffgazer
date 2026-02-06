import { useCallback, useRef, useState } from "react";
import type { SavedReview } from "@stargazer/schemas/review";
import { useReviews } from "@/features/history/hooks/use-reviews";
import { api } from "@/lib/api";

export function useReviewHistory() {
  const { reviews, isLoading, error: listError, refresh, deleteReview } = useReviews();
  const [currentReview, setCurrentReview] = useState<SavedReview | null>(null);
  const currentReviewRef = useRef(currentReview);
  currentReviewRef.current = currentReview;
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingReview, setIsLoadingReview] = useState(false);

  const loadReview = useCallback(async (id: string) => {
    setIsLoadingReview(true);
    setLoadError(null);
    try {
      const { review } = await api.getReview(id);
      setCurrentReview(review);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load review");
    } finally {
      setIsLoadingReview(false);
    }
  }, []);

  const removeReview = useCallback(
    async (id: string) => {
      await deleteReview(id);
      if (currentReviewRef.current?.metadata?.id === id) {
        setCurrentReview(null);
      }
    },
    [deleteReview]
  );

  return {
    reviews,
    currentReview,
    isLoading: isLoading || isLoadingReview,
    error: listError || loadError,
    refresh,
    loadReview,
    removeReview,
    clearCurrentReview: () => setCurrentReview(null),
  };
}
