import { useEffect, useEffectEvent, useRef } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useReviewStream } from './use-review-stream';
import { useReviewSettings } from './use-review-settings';
import { useConfigData, useConfigActions } from '@/app/providers/config-provider';
import { ReviewErrorCode } from '@stargazer/schemas/review';
import type { ReviewIssue } from '@stargazer/schemas/review';
import type { ReviewMode } from '../types';

const REPORT_COMPLETE_DELAY_MS = 2300;
const DEFAULT_COMPLETE_DELAY_MS = 400;

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

  const hasStartedRef = useRef(false);
  const hasStreamedRef = useRef(false);
  const completeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  useEffect(() => {
    if (hasStartedRef.current) return;
    if (configLoading) return;
    if (settingsLoading) return;
    if (!isConfigured) return;
    hasStartedRef.current = true;
    hasStreamedRef.current = true;

    let ignore = false;

    const options = {
      mode,
      lenses: defaultLenses,
    };

    if (params.reviewId) {
      resume(params.reviewId)
        .then((result) => {
          if (ignore) return;
          if (result.ok) return;

          if (result.error.code === ReviewErrorCode.SESSION_STALE) {
            start(options);
            return;
          }

          if (result.error.code === ReviewErrorCode.SESSION_NOT_FOUND) {
            stableOnComplete({
              issues: [],
              reviewId: params.reviewId ?? null,
              resumeFailed: true,
            });
          }
        })
        .catch(() => {
          // Transport/runtime errors — hook already set error state.
        });
    } else {
      if (!ignore) start(options);
    }

    return () => { ignore = true; };
  }, [mode, start, resume, configLoading, isConfigured, params.reviewId, settingsLoading, defaultLenses]);

  // Render-phase ref assignments (no effect needed)
  const stepsRef = useRef(state.steps);
  const issuesRef = useRef(state.issues);
  const reviewIdRef = useRef(state.reviewId);
  stepsRef.current = state.steps;
  issuesRef.current = state.issues;
  reviewIdRef.current = state.reviewId;

  // Delay transition so users see final step completions before switching views
  const prevIsStreamingRef = useRef(state.isStreaming);
  useEffect(() => {
    const wasStreaming = prevIsStreamingRef.current;
    prevIsStreamingRef.current = state.isStreaming;

    if (wasStreaming && !state.isStreaming && hasStreamedRef.current && !state.error) {
      if (completeTimeoutRef.current) {
        clearTimeout(completeTimeoutRef.current);
      }

      const reportStep = stepsRef.current.find(s => s.id === 'report');
      const reportCompleted = reportStep?.status === 'completed';
      const delayMs = reportCompleted ? REPORT_COMPLETE_DELAY_MS : DEFAULT_COMPLETE_DELAY_MS;

      completeTimeoutRef.current = setTimeout(() => {
        stableOnComplete({ issues: issuesRef.current, reviewId: reviewIdRef.current });
      }, delayMs);
    }
    return () => {
      if (completeTimeoutRef.current) {
        clearTimeout(completeTimeoutRef.current);
      }
    };
  }, [state.isStreaming, state.error]);

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
