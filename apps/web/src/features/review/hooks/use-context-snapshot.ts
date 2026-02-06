import { useEffect, useRef, useState } from 'react';
import type { ReviewContextResponse } from '@stargazer/api/types';
import { api } from '@/lib/api';

export function useContextSnapshot(reviewId: string | null | undefined, isStreaming: boolean, contextStepCompleted: boolean) {
  const [contextSnapshot, setContextSnapshot] = useState<ReviewContextResponse | null>(null);
  const contextFetchRef = useRef<string | null>(null);

  // Reset snapshot state when a new streaming session begins
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
    let ignore = false;

    api
      .getReviewContext()
      .then((data) => {
        if (!ignore) setContextSnapshot(data);
      })
      .catch(() => {
        if (!ignore) setContextSnapshot(null);
      });

    return () => { ignore = true; };
  }, [contextStepCompleted, isStreaming, reviewId]);

  return contextSnapshot;
}
