import { useEffect, useRef, useState } from "react";
import type { Result } from "../../result.js";
import type { StreamReviewError } from "../../review/index.js";
import type { ReviewMode } from "../../schemas/review/index.js";
import { ReviewErrorCode } from "../../schemas/review/index.js";

export interface UseReviewStartOptions {
  mode: ReviewMode;
  configLoading: boolean;
  settingsLoading: boolean;
  isConfigured: boolean;
  reviewId?: string;
  currentReviewId?: string | null;
  resume: (id: string) => Promise<Result<void, StreamReviewError>>;
  onNotFoundInSession?: (reviewId: string) => void;
  onStaleSession?: () => void;
}

export interface UseReviewStartResult {
  hasStarted: boolean;
  hasStreamed: boolean;
  setHasStarted: (value: boolean) => void;
  setHasStreamed: (value: boolean) => void;
}

export function useReviewStart(options: UseReviewStartOptions): UseReviewStartResult {
  const [hasStarted, setHasStarted] = useState(false);
  const [hasStreamed, setHasStreamed] = useState(false);

  const resumeRef = useRef(options.resume);
  const onNotFoundRef = useRef(options.onNotFoundInSession);
  const onStaleRef = useRef(options.onStaleSession);
  const currentReviewIdRef = useRef(options.currentReviewId);
  // Stable-ref escape hatch: refs are read ONLY inside the effect and async
  // continuation — never during render — so mid-render writes are safe under
  // concurrent rendering. See AGENTS.md react-useref rules.
  resumeRef.current = options.resume;
  onNotFoundRef.current = options.onNotFoundInSession;
  onStaleRef.current = options.onStaleSession;
  currentReviewIdRef.current = options.currentReviewId;

  useEffect(() => {
    if (options.configLoading || options.settingsLoading || !options.isConfigured) return;

    const reviewId = options.reviewId;
    if (!reviewId) return;

    if (currentReviewIdRef.current === reviewId) return;

    let ignore = false;

    setHasStarted(true);
    setHasStreamed(true);

    void resumeRef.current(reviewId).then((result) => {
      if (ignore) return;
      if (result.ok) return;

      if (result.error.code === ReviewErrorCode.SESSION_STALE) {
        onStaleRef.current?.();
      } else if (result.error.code === ReviewErrorCode.SESSION_NOT_FOUND) {
        onNotFoundRef.current?.(reviewId);
      }
    });

    return () => { ignore = true; };
  }, [
    options.configLoading,
    options.settingsLoading,
    options.isConfigured,
    options.reviewId,
  ]);

  return { hasStarted, hasStreamed, setHasStarted, setHasStreamed };
}
