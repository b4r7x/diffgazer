import { useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { useNavigate } from "@tanstack/react-router";

interface ApiError {
  status: number;
  message: string;
}

export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as Record<string, unknown>).status === "number" &&
    "message" in error &&
    typeof (error as Record<string, unknown>).message === "string"
  );
}

export function useReviewErrorHandler() {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleApiError = useCallback((error: unknown) => {
    const status = isApiError(error) ? error.status : undefined;
    const errorMessage = isApiError(error) ? error.message : undefined;

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
