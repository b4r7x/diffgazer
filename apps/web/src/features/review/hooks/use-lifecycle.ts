import {
  useCreateReview,
  useReviewLifecycleBase,
  useReviewSessionCache,
} from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import {
  describeReviewStartError,
  getAlternateReviewMode,
  type ReviewStartErrorDescription,
  sanitizePresentationText,
  sessionTerminationCopy,
} from "@diffgazer/core/review";
import type { LensStat } from "@diffgazer/core/schemas/events";
import type { ReviewIssue, ReviewMode, ReviewSeverity } from "@diffgazer/core/schemas/review";
import { toast } from "@diffgazer/ui/components/toast";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useConfigData } from "@/hooks/use-config";
import { useProviderConsent } from "@/hooks/use-provider-consent";
import { clearScopedRouteState } from "@/hooks/use-scoped-route-state";

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
  const { loadState, isReady, selectedReadiness, selectedConfiguration } = useConfigData();
  const createReview = useCreateReview();
  const providerConsent = useProviderConsent();
  const reviewSessionCache = useReviewSessionCache();
  const transitionRef = useRef<symbol | null>(null);
  const [isTransitionPending, setIsTransitionPending] = useState(false);
  const [startError, setStartError] = useState<ReviewStartErrorDescription | null>(null);

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
    readiness: selectedReadiness,
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
      ...s.orchestratorStats,
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

  const cancelOnServer = (preserveState = false) =>
    base.stream.cancel(base.stream.state.reviewId ?? params.reviewId ?? null, { preserveState });

  // Every review failure message is server- or transport-authored, so it passes
  // through the presentation sanitizer before it can reach the user.
  const reportFailure = (title: string, message: string) => {
    toast.error(title, { message: sanitizePresentationText(message) });
  };

  // Reported even when a later transition invalidated this cancel: the review is
  // still running and still billing, and the toast channel outlives navigation.
  const reportCancelFailure = (error: unknown) => {
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
        const outcome = await cancelOnServer(preserveState);
        // The failure is reported before the currency check: a cancel that did not
        // reach the server leaves the review running, and the user must hear that
        // even if they already navigated away. Only the continuation is skipped.
        if (outcome?.status === "error") {
          reportFailure("Cancel failed", outcome.message);
          return;
        }
        if (!isCurrentTransition(token)) return;
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
    void base.resumeReview(reviewId);
  };

  // Deep-links the providers screen to the affected configuration so key entry
  // lands on the right product; the stale remembered selection is cleared so
  // the link wins over it.
  const handleSetupProvider = () => {
    runCancelTransition(true, () => {
      const product = selectedConfiguration?.productId;
      if (product) {
        clearScopedRouteState("/settings/providers", "providerId");
      }
      navigate({ to: "/settings/providers", search: product ? { product } : {} });
    });
  };

  const startAlternateMode = () => {
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
        const description = describeReviewStartError(error);
        setStartError({ ...description, message: sanitizePresentationText(description.message) });
      },
    );
  };

  // Switching starts a new review, so it waits for the provider consent like
  // the start on home does; declining leaves the no-diff screen as it was.
  const handleSwitchMode = () => {
    providerConsent.require(startAlternateMode);
  };

  return {
    state: base.stream.state,
    gate: base.gate,
    contextSnapshot: base.contextSnapshot,
    contextRefreshError: base.contextRefreshError,
    retryContextRefresh: base.retryContextRefresh,
    loadingMessage: base.checks.loadingMessage,
    readiness: selectedReadiness,
    selectedConfiguration,
    canStart: base.start.canStart,
    isCompleting: base.completion.isCompleting,
    isReady,
    isTransitionPending,
    startError,
    handleCancel,
    handleBack,
    handleViewResults,
    handleRetry,
    handleSetupProvider,
    handleSwitchMode,
  };
}
