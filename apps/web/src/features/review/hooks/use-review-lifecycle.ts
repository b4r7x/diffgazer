import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useReviewLifecycleBase } from '@diffgazer/core/api/hooks';
import { useConfigData } from '@/app/providers/config-provider';
import type { ReviewIssue } from '@diffgazer/core/schemas/review';
import type { ReviewMode } from '@diffgazer/core/schemas/review';
import type { ReviewStreamState } from '@diffgazer/core/api/hooks';

export interface ReviewCompleteData {
  issues: ReviewIssue[];
  reviewId: string | null;
}

interface UseReviewLifecycleOptions {
  mode: ReviewMode;
  onComplete?: (data: ReviewCompleteData) => void;
  onReviewIdChange?: (reviewId: string) => void;
}

function logReviewLifecycle(event: string, data: Record<string, unknown> = {}) {
  console.log(`[diffgazer:review-lifecycle] ${event}`, {
    at: new Date().toISOString(),
    path: window.location.pathname,
    ...data,
  });
}

export function useReviewLifecycle({ mode, onComplete, onReviewIdChange }: UseReviewLifecycleOptions) {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const { isConfigured, provider, model, isLoading: configLoading } = useConfigData();

  // Ref-based stable callback pattern — avoids stale closures for onComplete
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onReviewIdChangeRef = useRef(onReviewIdChange);
  onReviewIdChangeRef.current = onReviewIdChange;
  const streamStateRef = useRef<ReviewStreamState | null>(null);

  const base = useReviewLifecycleBase({
    mode,
    configLoading,
    settingsLoading: false,
    isConfigured,
    reviewId: params.reviewId,
    onComplete: () => {
      const s = streamStateRef.current;
      logReviewLifecycle("onComplete", {
        mode,
        reviewId: s?.reviewId,
        issues: s?.issues.length ?? 0,
        isStreaming: s?.isStreaming,
        error: s?.error,
      });
      onCompleteRef.current?.({
        issues: s?.issues ?? [],
        reviewId: s?.reviewId ?? null,
      });
    },
    onNotFoundInSession: () => {
      logReviewLifecycle("onNotFoundInSession navigate home", {
        mode,
        paramReviewId: params.reviewId,
      });
      navigate({ to: '/' });
    },
  });

  streamStateRef.current = base.streamState;

  useEffect(() => {
    logReviewLifecycle("reviewId effect", {
      mode,
      paramReviewId: params.reviewId,
      streamReviewId: base.streamState.reviewId,
      isStreaming: base.streamState.isStreaming,
      error: base.streamState.error,
    });

    if (!base.streamState.reviewId) return;

    onReviewIdChangeRef.current?.(base.streamState.reviewId);

    if (params.reviewId === base.streamState.reviewId) return;

    logReviewLifecycle("navigate to live review id", {
      mode,
      fromReviewId: params.reviewId,
      toReviewId: base.streamState.reviewId,
    });
    navigate({
      to: '/review/{-$reviewId}',
      params: { reviewId: base.streamState.reviewId },
      search: (prev: Record<string, unknown>) => prev,
      replace: true,
    });
  }, [base.streamState.reviewId, params.reviewId, navigate]);

  const handleCancel = () => {
    logReviewLifecycle("handleCancel");
    base.stream.stop();
    navigate({ to: '/' });
  };

  const handleViewResults = () => {
    logReviewLifecycle("handleViewResults");
    base.stream.stop();
    base.skipDelay();
  };

  const handleSetupProvider = () => {
    logReviewLifecycle("handleSetupProvider");
    base.stream.stop();
    navigate({ to: '/settings/providers' });
  };

  const handleSwitchMode = () => {
    logReviewLifecycle("handleSwitchMode", { mode });
    base.stream.stop();
    const newMode = mode === 'staged' ? 'unstaged' : 'staged';
    navigate({ to: '/review/{-$reviewId}', params: {}, search: { mode: newMode }, replace: true });
    base.setHasStarted(false);
  };

  return {
    state: base.streamState,
    isConfigured,
    provider,
    model,
    loadingMessage: base.loadingMessage,
    isNoDiffError: base.isNoDiffError,
    handleCancel,
    handleViewResults,
    handleSetupProvider,
    handleSwitchMode,
  };
}
