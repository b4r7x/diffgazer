import {
  reviewQueries,
  useApi,
  useCreateReview,
  useReviewLifecycleBase,
  useReviewSessionCache,
} from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import {
  buildContextSnapshotView,
  describeReviewStartError,
  getAlternateReviewMode,
  type ReviewStartErrorDescription,
  sanitizePresentationText,
} from "@diffgazer/core/review";
import type { RunnableProductId } from "@diffgazer/core/schemas/config";
import type { LensStat } from "@diffgazer/core/schemas/events";
import type { ReviewIssue, ReviewMode, ReviewSeverity } from "@diffgazer/core/schemas/review";
import { toast } from "@diffgazer/ui/components/toast";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useConfigData } from "@/hooks/use-config";
import { useProviderConsent } from "@/hooks/use-provider-consent";
import { clearScopedRouteState } from "@/hooks/use-scoped-route-state";

/**
 * What the summary needs after the stream ends. The receipt half — scope, size,
 * model, when — is the evidence a run with no findings has instead of issues,
 * so it travels with every completed run and not only the ones that found
 * something. A saved run carries the same fields off disk.
 */
export interface ReviewCompleteData {
  issues: ReviewIssue[];
  reviewId: string | null;
  durationMs?: number;
  mode?: ReviewMode;
  createdAt?: string;
  fileCount?: number;
  additions?: number;
  deletions?: number;
  productId?: RunnableProductId;
  modelId?: string;
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
  const api = useApi();
  const reviewSessionCache = useReviewSessionCache();
  const queryClient = useQueryClient();
  const transitionRef = useRef<symbol | null>(null);
  const [transition, setTransition] = useState<
    | { status: "idle" }
    | { status: "pending" }
    | { status: "failed"; error: ReviewStartErrorDescription }
  >({ status: "idle" });
  const isTransitionPending = transition.status === "pending";
  const startError = transition.status === "failed" ? transition.error : null;

  const beginTransition = (): symbol | null => {
    if (transitionRef.current) return null;
    const token = Symbol("review-navigation-transition");
    transitionRef.current = token;
    setTransition({ status: "pending" });
    return token;
  };

  const isCurrentTransition = (token: symbol): boolean => transitionRef.current === token;

  const finishTransition = (token: symbol): void => {
    if (!isCurrentTransition(token)) return;
    transitionRef.current = null;
    setTransition((current) => (current.status === "pending" ? { status: "idle" } : current));
  };

  const invalidateTransition = (): boolean => {
    if (!transitionRef.current) return false;
    transitionRef.current = null;
    setTransition({ status: "idle" });
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
    // The session is gone, but everything it streamed is still on this screen
    // and the server wrote the partial run before it ended — so the screen stays
    // put on its terminal-error banner, which owns the copy, rather than
    // dropping the user back home.
    onStaleSession: () => clearActiveSession(activeReviewId),
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
    // The context the run was launched against carries the diff size; it is the
    // same snapshot the progress screen showed, not a second read.
    const changed = base.contextSnapshot ? buildContextSnapshotView(base.contextSnapshot) : null;
    clearActiveSession(s.reviewId ?? activeReviewId);
    onComplete?.({
      issues: s.issues,
      reviewId: s.reviewId ?? null,
      durationMs:
        s.startedAt && completedAt ? completedAt.getTime() - s.startedAt.getTime() : undefined,
      mode,
      createdAt: s.startedAt?.toISOString(),
      fileCount: s.fileProgress.total,
      additions: changed?.additions,
      deletions: changed?.deletions,
      productId: selectedConfiguration?.productId,
      modelId: selectedConfiguration?.selectedModelId ?? undefined,
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

  // The stream ended for good, so the live session is dead and the saved record
  // is the only account of the run left. It replaces this screen in history
  // rather than stacking on it: nobody needs a Back that returns to the failure.
  const handleViewRun = (reviewId: string) => {
    clearActiveSession(reviewId);
    // The saved record may have been fetched while the run was still streaming,
    // and that copy says "fall back to the stream" — the screen this replaces.
    // It stays fresh for a minute, so the summary would reuse it; invalidating
    // makes it read the finished run from the server instead.
    void queryClient.invalidateQueries({
      queryKey: reviewQueries.detail(api, reviewId).queryKey,
      exact: true,
    });
    navigate({
      to: "/review/{-$reviewId}",
      params: { reviewId },
      search: { mode },
      replace: true,
    });
  };

  const handleRetry = (reviewId: string) => {
    void base.resumeReview(reviewId);
  };

  // Deep-links the providers screen to the affected configuration so key entry
  // lands on the right product; the stale remembered selection is cleared so
  // the link wins over it.
  const goToProviders = (intent?: "select-model") => {
    runCancelTransition(true, () => {
      const product = selectedConfiguration?.productId;
      if (product) {
        clearScopedRouteState("/settings/providers", "providerId");
      }
      navigate({
        to: "/settings/providers",
        search: { ...(product ? { product } : {}), ...(intent ? { intent } : {}) },
      });
    });
  };

  const handleSetupProvider = () => goToProviders();

  // "Change model" opens the model dialog itself: the providers screen reads
  // the intent and lands there instead of leaving the user one more step away.
  const handleChangeModel = () => goToProviders("select-model");

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
        setTransition({
          status: "failed",
          error: { ...description, message: sanitizePresentationText(description.message) },
        });
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
    handleViewRun,
    handleRetry,
    handleSetupProvider,
    handleChangeModel,
    handleSwitchMode,
  };
}
