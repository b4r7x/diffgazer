import { useEffect, useEffectEvent } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useReviewStream } from './use-review-stream';
import { useReviewSettings } from './use-review-settings';
import { useReviewStart } from './use-review-start';
import { useReviewCompletion } from './use-review-completion';
import { useConfigData, useConfigActions } from '@/app/providers/config-provider';
import type { ReviewIssue } from '@stargazer/schemas/review';
import type { ReviewMode } from '@stargazer/schemas/review';

export interface ReviewCompleteData {
  issues: ReviewIssue[];
  reviewId: string | null;
  resumeFailed?: boolean;
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
  const { state, start, stop, resume } = useReviewStream();
  const { loading: settingsLoading, defaultLenses } = useReviewSettings();

  const stableOnComplete = useEffectEvent((data: ReviewCompleteData) => {
    onComplete?.(data);
  });

  // Sync review ID to URL
  useEffect(() => {
    if (!state.reviewId) return;
    if (params.reviewId === state.reviewId) return;

    navigate({
      to: '/review/$reviewId',
      params: { reviewId: state.reviewId },
      search: (prev: Record<string, unknown>) => prev,
      replace: true,
    });
  }, [state.reviewId, params.reviewId, navigate]);

  // Start or resume review
  const { hasStartedRef, hasStreamedRef } = useReviewStart({
    mode,
    configLoading,
    settingsLoading,
    isConfigured,
    defaultLenses,
    reviewId: params.reviewId,
    start,
    resume,
    onResumeFailed: stableOnComplete,
  });

  // Delay transition after streaming completes
  const { completeTimeoutRef, issuesRef, reviewIdRef } = useReviewCompletion({
    isStreaming: state.isStreaming,
    error: state.error,
    hasStreamed: hasStreamedRef.current,
    steps: state.steps,
    issues: state.issues,
    reviewId: state.reviewId,
    onComplete: stableOnComplete,
  });

  const handleCancel = () => {
    stop();
    navigate({ to: '/' });
  };

  const handleViewResults = () => {
    if (completeTimeoutRef.current) {
      clearTimeout(completeTimeoutRef.current);
    }
    stop();
    stableOnComplete({ issues: issuesRef.current, reviewId: reviewIdRef.current });
  };

  const handleSetupProvider = () => {
    stop();
    navigate({ to: '/settings/providers' });
  };

  const handleSwitchMode = () => {
    stop();
    const newMode = mode === 'staged' ? 'unstaged' : 'staged';
    navigate({ to: '/review', search: { mode: newMode }, replace: true });
    hasStartedRef.current = false;
  };

  const isNoDiffError =
    state.error?.includes('No staged changes') ||
    state.error?.includes('No unstaged changes');

  const diffStep = state.steps.find(s => s.id === 'diff');
  const isCheckingForChanges = state.isStreaming &&
    diffStep?.status !== 'completed' &&
    diffStep?.status !== 'error';

  const isInitializing = !hasStartedRef.current && isConfigured && !configLoading;

  const loadingMessage = configLoading || settingsLoading
    ? 'Loading...'
    : (isCheckingForChanges || isInitializing)
      ? 'Checking for changes...'
      : null;

  return {
    state,
    isConfigured,
    provider,
    model,
    loadingMessage,
    isNoDiffError,
    handleCancel,
    handleViewResults,
    handleSetupProvider,
    handleSwitchMode,
  };
}
