import { isApiError } from "@diffgazer/core/api";
import type { ReviewStreamState } from "@diffgazer/core/api/hooks";
import { useCreateReview, useReviewLifecycleBase } from "@diffgazer/core/api/hooks";
import type { ReviewIssue, ReviewMode } from "@diffgazer/core/schemas/review";
import { toast } from "@diffgazer/ui/components/toast";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useRef } from "react";
import { useConfigData } from "@/hooks/use-config";

function getAlternateReviewMode(mode: ReviewMode): ReviewMode {
  if (mode === "staged") return "unstaged";
  if (mode === "unstaged") return "staged";
  return "unstaged";
}

export interface ReviewCompleteData {
  issues: ReviewIssue[];
  reviewId: string | null;
}

interface UseReviewLifecycleOptions {
  mode: ReviewMode;
  onComplete?: (data: ReviewCompleteData) => void;
  onStreamNotFound?: (reviewId: string) => void;
}

export function useReviewLifecycle({
  mode,
  onComplete,
  onStreamNotFound,
}: UseReviewLifecycleOptions) {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const { isConfigured, provider, model, isLoading: configLoading } = useConfigData();
  const createReview = useCreateReview();

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onStreamNotFoundRef = useRef(onStreamNotFound);
  onStreamNotFoundRef.current = onStreamNotFound;
  const streamStateRef = useRef<ReviewStreamState | null>(null);
  const cancelOnServer = async (): Promise<string | null> => {
    const result = await Promise.resolve(
      base.stream.cancel(streamStateRef.current?.reviewId ?? null) as unknown as
        | string
        | null
        | Promise<string | null>,
    );
    return result ?? null;
  };

  const base = useReviewLifecycleBase({
    mode,
    configLoading,
    isConfigured,
    reviewId: params.reviewId,
    onComplete: () => {
      const s = streamStateRef.current;
      onCompleteRef.current?.({
        issues: s?.issues ?? [],
        reviewId: s?.reviewId ?? null,
      });
    },
    onNotFoundInSession: (reviewId: string) => {
      if (onStreamNotFoundRef.current) {
        onStreamNotFoundRef.current(reviewId);
      } else {
        navigate({ to: "/" });
      }
    },
    onStaleSession: () => {
      toast.error("Session Expired", {
        message: "The review session has become stale. Please start a new review.",
      });
      navigate({ to: "/" });
    },
  });

  streamStateRef.current = base.stream.state;

  const handleCancel = () => {
    void (async () => {
      const error = await cancelOnServer();
      if (error) {
        toast.error("Cancel failed", { message: error });
        return;
      }
      navigate({ to: "/" });
    })();
  };

  const handleViewResults = () => {
    base.completion.skipDelay();
  };

  const handleSetupProvider = () => {
    void (async () => {
      await cancelOnServer();
      navigate({ to: "/settings/providers" });
    })();
  };

  const handleSwitchMode = () => {
    void (async () => {
      await cancelOnServer();
      const alternateMode = getAlternateReviewMode(mode);
      try {
        const { reviewId } = await createReview.mutateAsync({ mode: alternateMode });
        navigate({
          to: "/review/{-$reviewId}",
          params: { reviewId },
          search: { mode: alternateMode, live: true },
          replace: true,
        });
      } catch (error) {
        const message = isApiError(error) ? error.message : "Could not create a review session.";
        toast.error("Failed to Start Review", { message });
      }
    })();
  };

  return {
    state: base.stream.state,
    isConfigured,
    provider,
    model,
    loadingMessage: base.checks.loadingMessage,
    isNoDiffError: base.checks.isNoDiffError,
    handleCancel,
    handleViewResults,
    handleSetupProvider,
    handleSwitchMode,
  };
}
