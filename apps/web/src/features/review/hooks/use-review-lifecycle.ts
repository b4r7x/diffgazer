import { useEffect, useEffectEvent } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useReviewStream, useApi, useSettings, useReviewStart, useReviewCompletion } from '@diffgazer/api/hooks';
import { resolveDefaultLenses, isNoDiffError as checkNoDiffError, isCheckingForChanges as checkForChanges, getLoadingMessage } from '@diffgazer/core/review';
import { useConfigData, useConfigActions } from '@/app/providers/config-provider';
import type { ReviewIssue } from '@diffgazer/schemas/review';
import type { ReviewMode } from '@diffgazer/schemas/review';

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
  const api = useApi();
  const { isConfigured, provider, model } = useConfigData();
  const { isLoading: configLoading } = useConfigActions();
  const { state, start: sharedStart, stop, resume } = useReviewStream();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const defaultLenses = resolveDefaultLenses(settings?.defaultLenses);

  const stableOnComplete = useEffectEvent((data: ReviewCompleteData) => {
    onComplete?.(data);
  });

  // Sync review ID to URL
  useEffect(() => {
    if (!state.reviewId) return;
    if (params.reviewId === state.reviewId) return;

    navigate({
      to: '/review/{-$reviewId}',
      params: { reviewId: state.reviewId },
      search: (prev: Record<string, unknown>) => prev,
      replace: true,
    });
  }, [state.reviewId, params.reviewId, navigate]);

  // Start or resume review
  const { hasStarted, hasStreamed, setHasStarted } = useReviewStart({
    mode,
    configLoading,
    settingsLoading,
    isConfigured,
    defaultLenses,
    reviewId: params.reviewId,
    start: (options) => sharedStart(options.mode!, options.lenses),
    resume,
    getActiveSession: api.getActiveReviewSession,
    onNotFoundInSession: () => {
      navigate({ to: '/' });
    },
  });

  // Delay transition after streaming completes
  const { skipDelay } = useReviewCompletion({
    isStreaming: state.isStreaming,
    error: state.error,
    hasStreamed,
    steps: state.steps,
    onComplete: () => stableOnComplete({ issues: state.issues, reviewId: state.reviewId }),
  });

  const handleCancel = () => {
    stop();
    navigate({ to: '/' });
  };

  const handleViewResults = () => {
    stop();
    skipDelay();
  };

  const handleSetupProvider = () => {
    stop();
    navigate({ to: '/settings/providers' });
  };

  const handleSwitchMode = () => {
    stop();
    const newMode = mode === 'staged' ? 'unstaged' : 'staged';
    navigate({ to: '/review/{-$reviewId}', params: {}, search: { mode: newMode }, replace: true });
    setHasStarted(false);
  };

  const noDiffError = checkNoDiffError(state.error);
  const checkingChanges = checkForChanges(state.isStreaming, state.steps);
  const isInitializing = !hasStarted && isConfigured && !configLoading;
  const loadingMessage = getLoadingMessage({ configLoading, settingsLoading, isCheckingForChanges: checkingChanges, isInitializing });

  return {
    state,
    isConfigured,
    provider,
    model,
    loadingMessage,
    isNoDiffError: noDiffError,
    handleCancel,
    handleViewResults,
    handleSetupProvider,
    handleSwitchMode,
  };
}
