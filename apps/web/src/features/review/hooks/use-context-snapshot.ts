import { useEffect, useRef, useState } from 'react';
import type { ReviewContextResponse } from '@stargazer/api/types';
import { api } from '@/lib/api';

export function useContextSnapshot(reviewId: string | null | undefined, isStreaming: boolean, contextStepCompleted: boolean) {
  const [contextSnapshot, setContextSnapshot] = useState<ReviewContextResponse | null>(null);
  const contextFetchRef = useRef<string | null>(null);

  useEffect(() => {
    if (isStreaming) {
      setContextSnapshot(null);
      contextFetchRef.current = null;
    }
  }, [isStreaming]);

  useEffect(() => {
    if (!reviewId) return;
    if (contextFetchRef.current === reviewId) return;
    if (!contextStepCompleted && isStreaming) return;

    contextFetchRef.current = reviewId;
    api
      .getReviewContext()
      .then((data) => {
        setContextSnapshot(data);
      })
      .catch(() => {
        setContextSnapshot(null);
      });
  }, [contextStepCompleted, isStreaming, reviewId]);

  return contextSnapshot;
}
