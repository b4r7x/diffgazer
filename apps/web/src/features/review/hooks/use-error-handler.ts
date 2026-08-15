import { isApiError } from "@diffgazer/core/api/types";
import { toast } from "@diffgazer/ui/components/toast";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { INVALID_REVIEW_ID_COPY } from "@/lib/review-error-copy";

function describeReviewLoadError(
  status: number | undefined,
  errorMessage: string | undefined,
): { title: string; message: string } {
  switch (status) {
    case 400:
      return INVALID_REVIEW_ID_COPY;
    case 404:
      return {
        title: "Review Not Found",
        message: "The review session was not found or has expired.",
      };
    default:
      return {
        title: "Error Loading Review",
        message: errorMessage || "An error occurred while loading the review.",
      };
  }
}

export function useReviewErrorHandler() {
  const navigate = useNavigate();

  const handleApiError = useCallback(
    (error: unknown) => {
      const status = isApiError(error) ? error.status : undefined;
      const errorMessage = isApiError(error) ? error.message : undefined;

      const { title, message } = describeReviewLoadError(status, errorMessage);

      toast.error(title, { message });
      navigate({ to: "/" });
    },
    [navigate],
  );

  return {
    handleApiError,
  };
}
