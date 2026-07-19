import { isApiError } from "@diffgazer/core/api";
import {
  useCreateReview,
  useReviewLifecycleBase,
  useReviewSessionCache,
} from "@diffgazer/core/api/hooks";
import {
  extractOrchestratorStats,
  getAlternateReviewMode,
  sessionTerminationCopy,
} from "@diffgazer/core/review";
import type { LensStat } from "@diffgazer/core/schemas/events";
import type { ReviewIssue, ReviewMode, ReviewSeverity } from "@diffgazer/core/schemas/review";
import { toast } from "@diffgazer/ui/components/toast";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useConfigData } from "@/hooks/use-config";

export interface ReviewCompleteData {
  issues: ReviewIssue[];
  reviewId: string | null;
  durationMs?: number;
  lensStats?: LensStat[];
  droppedDuplicates?: number;
  droppedBelowThreshold?: number;
  minSeverity?: ReviewSeverity;
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
  const { loadState, isConfigured, provider } = useConfigData();
  const createReview = useCreateReview();
  const reviewSessionCache = useReviewSessionCache();
  const transitionRef = useRef<symbol | null>(null);
  const [isTransitionPending, setIsTransitionPending] = useState(false);

  const beginTransition = (): symbol | null => {
    if (transitionRef.current) return null;
    const token = Symbol("review-navigation-transition");
    transitionRef.current = token;
    setIsTransitionPending(true);
    return token;
  };

  const isCurrentTransition = (token: symbol): boolean => transitionRef.current === token;

  const finishTransition = (token: symbol): void => {
    if (!isCurrentTransition(token)) return;
    transitionRef.current = null;
    setIsTransitionPending(false);
  };

  const invalidateTransition = (): boolean => {
    if (!transitionRef.current) return false;
    transitionRef.current = null;
    setIsTransitionPending(false);
    return true;
  };

  useEffect(
    () => () => {
      transitionRef.current = null;
    },
    [],
  );

  function clearActiveSession(reviewId: string | null | undefined) {
    if (reviewId) {
      reviewSessionCache.clearActiveSession(mode, reviewId);
    }
  }

  const base = useReviewLifecycleBase({
    configLoading: loadState.status === "loading",
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
    const completedAt = base.completion.completedAt;
    clearActiveSession(s.reviewId ?? activeReviewId);
    onComplete?.({
      issues: s.issues,
      reviewId: s.reviewId ?? null,
      durationMs:
        s.startedAt && completedAt ? completedAt.getTime() - s.startedAt.getTime() : undefined,
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

  const cancelOnServer = (preserveState = false): Promise<string | null> =>
    base.stream.cancel(base.stream.state.reviewId ?? params.reviewId ?? null, { preserveState });

  const handleCancel = () => {
    if (invalidateTransition()) {
      clearActiveSession(activeReviewId);
      navigate({ to: "/" });
      return;
    }
    const token = beginTransition();
    if (!token) return;
    void (async () => {
      try {
        const error = await cancelOnServer();
        if (!isCurrentTransition(token)) return;
        if (error) {
          toast.error("Cancel failed", { message: error });
          return;
        }
        clearActiveSession(activeReviewId);
        navigate({ to: "/" });
      } finally {
        finishTransition(token);
      }
    })();
  };

  // Leaves a running review without touching the server session, so it remains
  // resumable from home's "Resume Last Review".
  const handleBack = () => {
    invalidateTransition();
    if (base.checks.isTerminalStreamError) {
      clearActiveSession(activeReviewId);
    }
    navigate({ to: "/" });
  };

  const handleViewResults = () => {
    base.completion.skipDelay();
  };

  const handleRetry = (reviewId: string) => {
    void base.stream.resume(reviewId);
  };

  const handleSetupProvider = () => {
    const token = beginTransition();
    if (!token) return;
    void (async () => {
      try {
        const error = await cancelOnServer(true);
        if (!isCurrentTransition(token)) return;
        if (error) {
          toast.error("Cancel failed", { message: error });
          return;
        }
        clearActiveSession(activeReviewId);
        navigate({ to: "/settings/providers" });
      } finally {
        finishTransition(token);
      }
    })();
  };

  const handleSwitchMode = () => {
    const token = beginTransition();
    if (!token) return;
    void (async () => {
      try {
        const cancelError = await cancelOnServer(true);
        if (!isCurrentTransition(token)) return;
        if (cancelError) {
          toast.error("Cancel failed", { message: cancelError });
          return;
        }
        clearActiveSession(activeReviewId);
        const alternateMode = getAlternateReviewMode(mode);
        const { reviewId } = await createReview.mutateAsync({ mode: alternateMode });
        if (!isCurrentTransition(token)) return;
        navigate({
          to: "/review/{-$reviewId}",
          params: { reviewId },
          search: { mode: alternateMode, live: true },
          replace: true,
        });
      } catch (error) {
        if (!isCurrentTransition(token)) return;
        const message = isApiError(error) ? error.message : "Could not create a review session.";
        toast.error("Failed to Start Review", { message });
      } finally {
        finishTransition(token);
      }
    })();
  };

  return {
    state: base.stream.state,
    gate: base.gate,
    contextSnapshot: base.contextSnapshot,
    loadingMessage: base.checks.loadingMessage,
    provider,
    isTransitionPending,
    handleCancel,
    handleBack,
    handleViewResults,
    handleRetry,
    handleSetupProvider,
    handleSwitchMode,
  };
}
