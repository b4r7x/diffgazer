import { useEffect, useRef, useState } from 'react';
import type { ReviewContextResponse } from '@diffgazer/api/types';
import { api } from '@/lib/api';

export function useContextSnapshot(reviewId: string | null | undefined, isStreaming: boolean, contextStepCompleted: boolean) {
  const [contextSnapshot, setContextSnapshot] = useState<ReviewContextResponse | null>(null);
  const contextFetchRef = useRef<string | null>(null);

  // Return null during streaming — no extra render cycle needed
  const effectiveSnapshot = isStreaming ? null : contextSnapshot;

  // Reset fetch ref when streaming starts so we can re-fetch after completion
  useEffect(() => {
    if (isStreaming) {
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

  return effectiveSnapshot;
}
