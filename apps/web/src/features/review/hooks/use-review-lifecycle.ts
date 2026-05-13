import { useRef } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useReviewLifecycleBase } from '@diffgazer/core/api/hooks';
import { useConfigData } from '@/app/providers/config-provider';
import { toast } from '@diffgazer/ui/components/toast';
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
  const { isConfigured, provider, model, isLoading: configLoading } = useConfigData();

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
    onStaleSession: () => {
      toast.error('Session Expired', { message: 'The review session has become stale. Please start a new review.' });
      navigate({ to: '/' });
    },
  });

  streamStateRef.current = base.streamState;

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
    navigate({ to: '/', replace: true });
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
