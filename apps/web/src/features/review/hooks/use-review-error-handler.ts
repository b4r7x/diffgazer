import { useToast } from "@/components/ui/toast";
import { useNavigate } from "@tanstack/react-router";

export function useReviewErrorHandler() {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const redirectWithToast = (title: string, message: string) => {
    showToast({
      variant: "error",
      title,
      message,
    });
    navigate({ to: "/" });
  };

  const handleInvalidFormat = () => {
    redirectWithToast("Invalid Review ID", "The review ID format is invalid.");
  };

  const handleNotFound = () => {
    redirectWithToast("Review Not Found", "The review session was not found or has expired.");
  };

  const handleApiError = (error: unknown) => {
    const err = error as { status?: number; message?: string };
    if (err.status === 400) {
      handleInvalidFormat();
    } else if (err.status === 404) {
      handleNotFound();
    } else {
      redirectWithToast(
        "Error Loading Review",
        err.message || "An error occurred while loading the review."
      );
    }
  };

  return {
    handleApiError,
  };
}
