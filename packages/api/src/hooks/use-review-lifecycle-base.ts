import { useReviewStream } from "./use-review-stream.js";
import { useSettings } from "./config.js";
import { useApi } from "./context.js";
import { useReviewStart } from "./use-review-start.js";
import { useReviewCompletion } from "./use-review-completion.js";
import {
  resolveDefaultLenses,
  isNoDiffError as checkNoDiffError,
  isCheckingForChanges as checkForChanges,
  getLoadingMessage,
} from "@diffgazer/core/review";
import type { ReviewStreamState } from "./use-review-stream.js";
import type { ReviewMode, LensId } from "@diffgazer/schemas/review";

export interface UseReviewLifecycleBaseOptions {
  mode: ReviewMode;
  configLoading: boolean;
  settingsLoading: boolean;
  isConfigured: boolean;
  reviewId?: string;
  startToken?: number;
  onComplete: () => void;
  onNotFoundInSession?: (reviewId: string) => void;
}

export interface UseReviewLifecycleBaseResult {
  // Stream controls
  stream: {
    start: (mode: ReviewMode, lenses?: LensId[]) => Promise<void>;
    stop: () => void;
    abort: () => void;
  };

  // Stream state
  streamState: ReviewStreamState;

  // Derived display state
  isNoDiffError: boolean;
  isCheckingForChanges: boolean;
  loadingMessage: string | null;

  // Completion
  isCompleting: boolean;
  skipDelay: () => void;
  resetCompletion: () => void;

  // Start state
  hasStarted: boolean;
  hasStreamed: boolean;
  setHasStarted: (value: boolean) => void;
  setHasStreamed: (value: boolean) => void;
}

export function useReviewLifecycleBase(
  options: UseReviewLifecycleBaseOptions,
): UseReviewLifecycleBaseResult {
  const api = useApi();
  const stream = useReviewStream();
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const defaultLenses = resolveDefaultLenses(settings?.defaultLenses);

  const { hasStarted, hasStreamed, setHasStarted, setHasStreamed } = useReviewStart({
    mode: options.mode,
    configLoading: options.configLoading,
    settingsLoading: settingsLoading || options.settingsLoading,
    isConfigured: options.isConfigured,
    defaultLenses,
    reviewId: options.reviewId,
    startToken: options.startToken,
    start: (opts) => stream.start(opts.mode!, opts.lenses),
    resume: stream.resume,
    getActiveSession: api.getActiveReviewSession,
    onNotFoundInSession: options.onNotFoundInSession,
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
    settingsLoading: settingsLoading || options.settingsLoading,
    isCheckingForChanges,
    isInitializing,
  });

  return {
    stream: {
      start: stream.start,
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
