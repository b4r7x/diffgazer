import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { ReviewMetadata } from "@stargazer/schemas/review";

export function useReviews(projectPath?: string) {
  const [reviews, setReviews] = useState<ReviewMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = async () => {
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
  };

  const deleteReview = async (id: string) => {
    try {
      await api.deleteReview(id);
      setReviews((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete review");
      fetchReviews();
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [projectPath]);

  return {
    reviews,
    isLoading,
    error,
    refresh: fetchReviews,
    deleteReview,
  };
}
