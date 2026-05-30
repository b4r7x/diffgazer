import { useReviewStream } from "./use-review-stream";
import { useSettings } from "./config";
import { useReviewStart } from "./use-review-start";
import { useReviewCompletion } from "./use-review-completion";
import {
  isNoDiffError as checkNoDiffError,
  isCheckingForChanges as checkForChanges,
  getLoadingMessage,
} from "@diffgazer/core/review";
import type { ReviewStreamState } from "./use-review-stream";
import type { ReviewMode } from "@diffgazer/core/schemas/review";

export interface UseReviewLifecycleBaseOptions {
  mode: ReviewMode;
  configLoading: boolean;
  isConfigured: boolean;
  reviewId?: string;
  onComplete: () => void;
  onNotFoundInSession?: (reviewId: string) => void;
  onStaleSession?: () => void;
}

export interface UseReviewLifecycleBaseResult {
  stream: {
    stop: () => void;
    abort: () => void;
    cancel: (reviewId: string | null) => void;
    state: ReviewStreamState;
  };

  checks: {
    isNoDiffError: boolean;
    isCheckingForChanges: boolean;
    loadingMessage: string | null;
  };

  completion: {
    isCompleting: boolean;
    skipDelay: () => void;
    resetCompletion: () => void;
  };

  start: {
    hasStarted: boolean;
    hasStreamed: boolean;
    setHasStarted: (value: boolean) => void;
    setHasStreamed: (value: boolean) => void;
  };
}

export function useReviewLifecycleBase(
  options: UseReviewLifecycleBaseOptions,
): UseReviewLifecycleBaseResult {
  const stream = useReviewStream();
  const { isLoading: settingsLoading } = useSettings();

  const { hasStarted, hasStreamed, setHasStarted, setHasStreamed } = useReviewStart({
    mode: options.mode,
    configLoading: options.configLoading,
    settingsLoading,
    isConfigured: options.isConfigured,
    reviewId: options.reviewId,
    currentReviewId: stream.state.reviewId,
    resume: stream.resume,
    onNotFoundInSession: options.onNotFoundInSession,
    onStaleSession: options.onStaleSession,
  });

  const { isCompleting, skipDelay, reset: resetCompletion } = useReviewCompletion({
    isStreaming: stream.state.isStreaming,
    error: stream.state.error,
    hasStreamed,
    steps: stream.state.steps,
    onComplete: options.onComplete,
  });

  const isNoDiffError = checkNoDiffError(stream.state.error);
  const isCheckingForChanges = checkForChanges(stream.state.isStreaming, stream.state.steps);
  const isInitializing = !hasStarted && options.isConfigured && !options.configLoading;

  const loadingMessage = getLoadingMessage({
    configLoading: options.configLoading,
    settingsLoading,
    isCheckingForChanges,
    isInitializing,
  });

  return {
    stream: {
      stop: stream.stop,
      abort: stream.abort,
      cancel: stream.cancel,
      state: stream.state,
    },
    checks: {
      isNoDiffError,
      isCheckingForChanges,
      loadingMessage,
    },
    completion: {
      isCompleting,
      skipDelay,
      resetCompletion,
    },
    start: {
      hasStarted,
      hasStreamed,
      setHasStarted,
      setHasStreamed,
    },
  };
}
