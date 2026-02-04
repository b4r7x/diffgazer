import { useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { useNavigate } from "@tanstack/react-router";

export function useReviewErrorHandler() {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleApiError = useCallback((error: unknown) => {
    const err = error as { status?: number; message?: string };

    const title =
      err.status === 400 ? "Invalid Review ID" :
      err.status === 404 ? "Review Not Found" :
      "Error Loading Review";

    const message =
      err.status === 400 ? "The review ID format is invalid." :
      err.status === 404 ? "The review session was not found or has expired." :
      err.message || "An error occurred while loading the review.";

    showToast({
      variant: "error",
      title,
      message,
    });
    navigate({ to: "/" });
  }, [showToast, navigate]);

  return {
    handleApiError,
  };
}
