import { isApiError } from "@diffgazer/core/api";
import type { ReviewStreamState } from "@diffgazer/core/api/hooks";
import { useCreateReview, useReviewLifecycleBase } from "@diffgazer/core/api/hooks";
import { sessionTerminationCopy } from "@diffgazer/core/review";
import type { LensStat } from "@diffgazer/core/schemas/events";
import type { ReviewIssue, ReviewMode, ReviewSeverity } from "@diffgazer/core/schemas/review";
import { toast } from "@diffgazer/ui/components/toast";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffectEvent } from "react";
import { useConfigData } from "@/hooks/use-config";

function getAlternateReviewMode(mode: ReviewMode): ReviewMode {
  if (mode === "staged") return "unstaged";
  if (mode === "unstaged") return "staged";
  return "unstaged";
}

export interface ReviewCompleteData {
  issues: ReviewIssue[];
  reviewId: string | null;
  lensStats?: LensStat[];
  droppedBelowThreshold?: number;
  minSeverity?: ReviewSeverity;
}

/** Pulls the persisted-equivalent lens stats and drop count from the live event log. */
function extractOrchestratorStats(
  state: ReviewStreamState | null,
): Pick<ReviewCompleteData, "lensStats" | "droppedBelowThreshold" | "minSeverity"> {
  const events = state?.events ?? [];
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event?.type === "orchestrator_complete") {
      return {
        lensStats: event.lensStats,
        droppedBelowThreshold: event.droppedBelowThreshold,
        minSeverity: event.minSeverity,
      };
    }
  }
  return {};
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

  const base = useReviewLifecycleBase({
    configLoading,
    isConfigured,
    reviewId: params.reviewId,
    onComplete: () => emitComplete(),
    onNotFoundInSession: (reviewId: string) => emitStreamNotFound(reviewId),
    onStaleSession: (code) => emitStaleSession(code),
  });

  const emitComplete = useEffectEvent(() => {
    const s = base.stream.state;
    onComplete?.({
      issues: s.issues,
      reviewId: s.reviewId ?? null,
      ...extractOrchestratorStats(s),
    });
  });

  const emitStreamNotFound = useEffectEvent((reviewId: string) => {
    if (onStreamNotFound) {
      onStreamNotFound(reviewId);
    } else {
      navigate({ to: "/" });
    }
  });

  const emitStaleSession = useEffectEvent((code: Parameters<typeof sessionTerminationCopy>[0]) => {
    const copy = sessionTerminationCopy(code);
    toast.error(copy.title, { message: copy.message });
    navigate({ to: "/" });
  });

  const cancelOnServer = (): Promise<string | null> =>
    base.stream.cancel(base.stream.state.reviewId ?? null);

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

  // Leaves the review screen without touching the server session: the run keeps
  // streaming server-side and stays resumable from home's "Resume Last Review".
  const handleBack = () => {
    navigate({ to: "/" });
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
    gate: base.gate,
    contextSnapshot: base.contextSnapshot,
    loadingMessage: base.checks.loadingMessage,
    provider,
    model,
    handleCancel,
    handleBack,
    handleViewResults,
    handleSetupProvider,
    handleSwitchMode,
  };
}
