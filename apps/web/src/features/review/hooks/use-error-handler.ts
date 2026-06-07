import { isApiError } from "@diffgazer/core/api/types";
import { toast } from "@diffgazer/ui/components/toast";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

export function useReviewErrorHandler() {
  const navigate = useNavigate();

  const handleApiError = useCallback(
    (error: unknown) => {
      const status = isApiError(error) ? error.status : undefined;
      const errorMessage = isApiError(error) ? error.message : undefined;

      let title = "Error Loading Review";
      if (status === 400) title = "Invalid Review ID";
      if (status === 404) title = "Review Not Found";

      let message = errorMessage || "An error occurred while loading the review.";
      if (status === 400) message = "The review ID format is invalid.";
      if (status === 404) message = "The review session was not found or has expired.";

      toast.error(title, { message });
      navigate({ to: "/" });
    },
    [navigate],
  );

  return {
    handleApiError,
  };
}
