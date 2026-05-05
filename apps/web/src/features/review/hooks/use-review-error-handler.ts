

import { toast } from "@diffgazer/ui/components/toast";
import { useNavigate } from "@tanstack/react-router";
import { isApiError } from "@diffgazer/core/api/types";

export { isApiError };

export function useReviewErrorHandler() {
  const navigate = useNavigate();

  const handleApiError = (error: unknown) => {
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

    toast.error(title, { message });
    navigate({ to: "/" });
  };

  return {
    handleApiError,
  };
}
