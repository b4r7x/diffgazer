import { isApiError } from "@diffgazer/core/api";
import type { ReviewStreamState } from "@diffgazer/core/api/hooks";
import {
  useCreateReview,
  useReviewLifecycleBase,
  useReviewSessionCache,
} from "@diffgazer/core/api/hooks";
import { sessionTerminationCopy } from "@diffgazer/core/review";
import type { LensStat } from "@diffgazer/core/schemas/events";
import type { ReviewIssue, ReviewMode, ReviewSeverity } from "@diffgazer/core/schemas/review";
import { toast } from "@diffgazer/ui/components/toast";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
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
  const reviewSessionCache = useReviewSessionCache();

  function clearActiveSession(reviewId: string | null | undefined) {
    if (reviewId) {
      reviewSessionCache.clearActiveSession(mode, reviewId);
    }
  }

  const base = useReviewLifecycleBase({
    configLoading,
    isConfigured,
    reviewId: params.reviewId,
    onStreamComplete: () => clearActiveSession(base.stream.state.reviewId ?? params.reviewId),
    onComplete: emitComplete,
    onNotFoundInSession: (reviewId: string) => emitStreamNotFound(reviewId),
    onStaleSession: (code) => emitStaleSession(code),
  });
  const activeReviewId = base.stream.state.reviewId ?? params.reviewId ?? null;

  useEffect(() => {
    if (base.checks.isNoDiffError && activeReviewId) {
      reviewSessionCache.clearActiveSession(mode, activeReviewId);
    }
  }, [base.checks.isNoDiffError, activeReviewId, mode, reviewSessionCache]);

  function emitComplete() {
    const s = base.stream.state;
    clearActiveSession(s.reviewId ?? activeReviewId);
    onComplete?.({
      issues: s.issues,
      reviewId: s.reviewId ?? null,
      ...extractOrchestratorStats(s),
    });
  }

  function emitStreamNotFound(reviewId: string) {
    clearActiveSession(reviewId);
    if (onStreamNotFound) {
      onStreamNotFound(reviewId);
    } else {
      navigate({ to: "/" });
    }
  }

  function emitStaleSession(code: Parameters<typeof sessionTerminationCopy>[0]) {
    const copy = sessionTerminationCopy(code);
    clearActiveSession(activeReviewId);
    toast.error(copy.title, { message: copy.message });
    navigate({ to: "/" });
  }

  const cancelOnServer = (): Promise<string | null> =>
    base.stream.cancel(base.stream.state.reviewId ?? params.reviewId ?? null);

  const handleCancel = () => {
    void (async () => {
      const error = await cancelOnServer();
      if (error) {
        toast.error("Cancel failed", { message: error });
        return;
      }
      clearActiveSession(activeReviewId);
      navigate({ to: "/" });
    })();
  };

  // Leaves a running review without touching the server session, so it remains
  // resumable from home's "Resume Last Review".
  const handleBack = () => {
    if (base.checks.isTerminalStreamError) {
      clearActiveSession(activeReviewId);
    }
    navigate({ to: "/" });
  };

  const handleViewResults = () => {
    base.completion.skipDelay();
  };

  const handleSetupProvider = () => {
    void (async () => {
      const error = await cancelOnServer();
      if (error) {
        toast.error("Cancel failed", { message: error });
        return;
      }
      clearActiveSession(activeReviewId);
      navigate({ to: "/settings/providers" });
    })();
  };

  const handleSwitchMode = () => {
    void (async () => {
      const cancelError = await cancelOnServer();
      if (cancelError) {
        toast.error("Cancel failed", { message: cancelError });
        return;
      }
      clearActiveSession(activeReviewId);
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
