import { useReviewStream } from "./use-review-stream.js";
import { useSettings } from "./config.js";
import { useReviewStart } from "./use-review-start.js";
import { useReviewCompletion } from "./use-review-completion.js";
import {
  isNoDiffError as checkNoDiffError,
  isCheckingForChanges as checkForChanges,
  getLoadingMessage,
} from "@diffgazer/core/review";
import type { ReviewStreamState } from "./use-review-stream.js";
import type { ReviewMode } from "@diffgazer/core/schemas/review";

export interface UseReviewLifecycleBaseOptions {
  mode: ReviewMode;
  configLoading: boolean;
  settingsLoading: boolean;
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
  };

  streamState: ReviewStreamState;

  isNoDiffError: boolean;
  isCheckingForChanges: boolean;
  loadingMessage: string | null;

  isCompleting: boolean;
  skipDelay: () => void;
  resetCompletion: () => void;

  hasStarted: boolean;
  hasStreamed: boolean;
  setHasStarted: (value: boolean) => void;
  setHasStreamed: (value: boolean) => void;
}

export function useReviewLifecycleBase(
  options: UseReviewLifecycleBaseOptions,
): UseReviewLifecycleBaseResult {
  const stream = useReviewStream();
  const { isLoading: settingsLoading } = useSettings();
  const isSettingsLoading = settingsLoading || options.settingsLoading;

  const { hasStarted, hasStreamed, setHasStarted, setHasStreamed } = useReviewStart({
    mode: options.mode,
    configLoading: options.configLoading,
    settingsLoading: isSettingsLoading,
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
    settingsLoading: isSettingsLoading,
    isCheckingForChanges,
    isInitializing,
  });

  return {
    stream: {
      stop: stream.stop,
      abort: stream.abort,
    },
    streamState: stream.state,
    isNoDiffError,
    isCheckingForChanges,
    loadingMessage,
    isCompleting,
    skipDelay,
    resetCompletion,
    hasStarted,
    hasStreamed,
    setHasStarted,
    setHasStreamed,
  };
}
