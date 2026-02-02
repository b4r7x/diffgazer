import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { TriageReviewMetadata, SavedTriageReview, DrilldownResult } from "@repo/schemas";

export function useTriageReviews(projectPath?: string) {
  const [reviews, setReviews] = useState<TriageReviewMetadata[]>([]);
  const [currentReview, setCurrentReview] = useState<SavedTriageReview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    if (!projectPath) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<TriageReviewMetadata[]>("/triage/reviews", { projectPath });
      setReviews(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch reviews");
    } finally {
      setIsLoading(false);
    }
  }, [projectPath]);

  const fetchReview = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<SavedTriageReview>(`/triage/reviews/${id}`);
      setCurrentReview(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch review");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteReview = useCallback(async (id: string) => {
    try {
      await api.delete(`/triage/reviews/${id}`);
      setReviews(prev => prev.filter(r => r.id !== id));
      if (currentReview?.metadata.id === id) {
        setCurrentReview(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete review");
      fetchReviews();
    }
  }, [currentReview?.metadata.id, fetchReviews]);

  const drilldown = useCallback(async (reviewId: string, issueId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.post<DrilldownResult>(`/triage/reviews/${reviewId}/drilldown`, { issueId });
      if (currentReview && currentReview.metadata.id === reviewId) {
        setCurrentReview(prev => prev ? {
          ...prev,
          drilldowns: [...prev.drilldowns, result],
        } : null);
      }
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger drilldown");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentReview]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  return {
    reviews,
    currentReview,
    isLoading,
    error,
    refresh: fetchReviews,
    fetchReview,
    deleteReview,
    drilldown,
  };
}
