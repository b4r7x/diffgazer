import { useState } from "react";
import { useReviews, useReview, useDeleteReview } from "@diffgazer/api/hooks";

export function useReviewHistory() {
  const reviewsQuery = useReviews();
  const deleteReviewMutation = useDeleteReview();
  const reviews = reviewsQuery.data?.reviews ?? [];
  const isLoadingList = reviewsQuery.isLoading;
  const listError = reviewsQuery.error?.message ?? null;

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const reviewQuery = useReview(selectedId ?? "");
  const currentReview = selectedId ? (reviewQuery.data?.review ?? null) : null;
  const isLoadingReview = selectedId ? reviewQuery.isLoading : false;
  const loadError = reviewQuery.error?.message ?? null;

  const loadReview = (id: string) => {
    setSelectedId(id);
  };

  const removeReview = async (id: string) => {
    await deleteReviewMutation.mutateAsync(id);
    if (selectedId === id) setSelectedId(null);
  };

  return {
    reviews,
    currentReview,
    isLoading: isLoadingList || isLoadingReview,
    error: listError || loadError,
    refresh: () => { reviewsQuery.refetch(); },
    loadReview,
    removeReview,
    clearCurrentReview: () => setSelectedId(null),
  };
}
