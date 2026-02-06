import { useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { useNavigate } from "@tanstack/react-router";

export function useReviewErrorHandler() {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleApiError = useCallback((error: unknown) => {
    const isErrorObject = typeof error === 'object' && error !== null;
    const status = isErrorObject && 'status' in error ? (error as { status: number }).status : undefined;
    const errorMessage = isErrorObject && 'message' in error ? (error as { message: string }).message : undefined;

    const title =
      status === 400 ? "Invalid Review ID" :
      status === 404 ? "Review Not Found" :
      "Error Loading Review";

    const message =
      status === 400 ? "The review ID format is invalid." :
      status === 404 ? "The review session was not found or has expired." :
      errorMessage || "An error occurred while loading the review.";

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
