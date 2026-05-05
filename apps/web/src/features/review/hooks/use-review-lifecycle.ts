import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useReviewLifecycleBase } from '@diffgazer/core/api/hooks';
import { useConfigData, useConfigActions } from '@/app/providers/config-provider';
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
}

export function useReviewLifecycle({ mode, onComplete }: UseReviewLifecycleOptions) {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const { isConfigured, provider, model } = useConfigData();
  const { isLoading: configLoading } = useConfigActions();

  // Ref-based stable callback pattern — avoids stale closures for onComplete
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const streamStateRef = useRef<ReviewStreamState | null>(null);

  const base = useReviewLifecycleBase({
    mode,
    configLoading,
    settingsLoading: false,
    isConfigured,
    reviewId: params.reviewId,
    onComplete: () => {
      const s = streamStateRef.current;
      onCompleteRef.current?.({
        issues: s?.issues ?? [],
        reviewId: s?.reviewId ?? null,
      });
    },
    onNotFoundInSession: () => {
      navigate({ to: '/' });
    },
  });

  // Keep ref in sync for the onComplete callback
  streamStateRef.current = base.streamState;

  // Sync review ID to URL
  useEffect(() => {
    if (!base.streamState.reviewId) return;
    if (params.reviewId === base.streamState.reviewId) return;

    navigate({
      to: '/review/{-$reviewId}',
      params: { reviewId: base.streamState.reviewId },
      search: (prev: Record<string, unknown>) => prev,
      replace: true,
    });
  }, [base.streamState.reviewId, params.reviewId, navigate]);

  const handleCancel = () => {
    base.stream.stop();
    navigate({ to: '/' });
  };

  const handleViewResults = () => {
    base.stream.stop();
    base.skipDelay();
  };

  const handleSetupProvider = () => {
    base.stream.stop();
    navigate({ to: '/settings/providers' });
  };

  const handleSwitchMode = () => {
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
