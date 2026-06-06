import type { ReviewStreamState } from '@diffgazer/core/api/hooks';
import { useReviewLifecycleBase } from '@diffgazer/core/api/hooks';
import type { ReviewIssue, ReviewMode } from '@diffgazer/core/schemas/review';
import { toast } from '@diffgazer/ui/components/toast';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useRef } from 'react';
import { useConfigData } from '@/app/providers/config';

export interface ReviewCompleteData {
  issues: ReviewIssue[];
  reviewId: string | null;
}

interface UseReviewLifecycleOptions {
  mode: ReviewMode;
  onComplete?: (data: ReviewCompleteData) => void;
  onStreamNotFound?: (reviewId: string) => void;
}

export function useReviewLifecycle({ mode, onComplete, onStreamNotFound }: UseReviewLifecycleOptions) {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const { isConfigured, provider, model, isLoading: configLoading } = useConfigData();

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onStreamNotFoundRef = useRef(onStreamNotFound);
  onStreamNotFoundRef.current = onStreamNotFound;
  const streamStateRef = useRef<ReviewStreamState | null>(null);

  const base = useReviewLifecycleBase({
    mode,
    configLoading,
    isConfigured,
    reviewId: params.reviewId,
    onComplete: () => {
      const s = streamStateRef.current;
      onCompleteRef.current?.({
        issues: s?.issues ?? [],
        reviewId: s?.reviewId ?? null,
      });
    },
    onNotFoundInSession: (reviewId: string) => {
      if (onStreamNotFoundRef.current) {
        onStreamNotFoundRef.current(reviewId);
      } else {
        navigate({ to: '/' });
      }
    },
    onStaleSession: () => {
      toast.error('Session Expired', { message: 'The review session has become stale. Please start a new review.' });
      navigate({ to: '/' });
    },
  });

  streamStateRef.current = base.stream.state;

  const handleCancel = () => {
    base.stream.cancel(streamStateRef.current?.reviewId ?? null);
    navigate({ to: '/' });
  };

  const handleViewResults = () => {
    base.completion.skipDelay();
  };

  const handleSetupProvider = () => {
    base.stream.cancel(streamStateRef.current?.reviewId ?? null);
    navigate({ to: '/settings/providers' });
  };

  const handleSwitchMode = () => {
    base.stream.cancel(streamStateRef.current?.reviewId ?? null);
    navigate({ to: '/', replace: true });
  };

  return {
    state: base.stream.state,
    isConfigured,
    provider,
    model,
    loadingMessage: base.checks.loadingMessage,
    isNoDiffError: base.checks.isNoDiffError,
    handleCancel,
    handleViewResults,
    handleSetupProvider,
    handleSwitchMode,
  };
}
