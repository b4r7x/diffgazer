import {
  useCreateReview,
  useReviewLifecycleBase,
  useReviewSessionCache,
} from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import {
  describeReviewStartError,
  extractOrchestratorStats,
  getAlternateReviewMode,
  sanitizePresentationText,
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
  allowResumeWithoutSetup?: boolean;
  onComplete?: (data: ReviewCompleteData) => void;
  onStreamNotFound?: (reviewId: string) => void;
}

export function useReviewLifecycle({
  mode,
  allowResumeWithoutSetup = false,
  onComplete,
  onStreamNotFound,
}: UseReviewLifecycleOptions) {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const {
    loadState,
    isConfigured,
    isReady,
    selectedReadiness,
    selectedIdentity,
    selectedConfiguration,
  } = useConfigData();
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
    readiness: selectedReadiness,
    configuration: selectedIdentity,
    allowResumeWithoutSetup,
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

  // Every review failure message is server- or transport-authored, so it passes
  // through the presentation sanitizer before it can reach the user.
  const reportFailure = (title: string, message: string) => {
    toast.error(title, { message: sanitizePresentationText(message) });
  };

  const reportCancelFailure = (error: unknown, token: symbol) => {
    if (!isCurrentTransition(token)) return;
    reportFailure("Cancel failed", getErrorMessage(error, "Unknown error"));
  };

  const runCancelTransition = (
    preserveState: boolean,
    onCancelled: (token: symbol) => void | Promise<void>,
    onError: (error: unknown, token: symbol) => void = reportCancelFailure,
  ) => {
    const token = beginTransition();
    if (!token) return;
    void (async () => {
      try {
        const error = await cancelOnServer(preserveState);
        if (!isCurrentTransition(token)) return;
        if (error) {
          reportFailure("Cancel failed", error);
          return;
        }
        clearActiveSession(activeReviewId);
        await onCancelled(token);
      } catch (error) {
        onError(error, token);
      } finally {
        finishTransition(token);
      }
    })();
  };

  const handleCancel = () => {
    if (invalidateTransition()) {
      clearActiveSession(activeReviewId);
      navigate({ to: "/" });
      return;
    }
    runCancelTransition(false, () => {
      navigate({ to: "/" });
    });
  };

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
    runCancelTransition(true, () => {
      navigate({ to: "/settings/providers" });
    });
  };

  const handleSwitchMode = () => {
    runCancelTransition(
      true,
      async (token) => {
        const alternateMode = getAlternateReviewMode(mode);
        const { reviewId } = await createReview.mutateAsync({ mode: alternateMode });
        if (!isCurrentTransition(token)) return;
        navigate({
          to: "/review/{-$reviewId}",
          params: { reviewId },
          search: { mode: alternateMode, live: true },
          replace: true,
        });
      },
      (error, token) => {
        if (!isCurrentTransition(token)) return;
        const { title, message } = describeReviewStartError(error);
        reportFailure(title, message);
      },
    );
  };

  return {
    state: base.stream.state,
    gate: base.gate,
    contextSnapshot: base.contextSnapshot,
    loadingMessage: base.checks.loadingMessage,
    readiness: selectedReadiness,
    selectedConfiguration,
    startIdentity: base.start.identity,
    readinessGate: base.start.readinessGate,
    canStart: base.start.canStart,
    isCompleting: base.completion.isCompleting,
    isReady,
    isTransitionPending,
    handleCancel,
    handleBack,
    handleViewResults,
    handleRetry,
    handleSetupProvider,
    handleSwitchMode,
  };
}
