import {
  isCheckingForChanges as checkForChanges,
  isNoDiffError as checkNoDiffError,
  getLoadingMessage,
  type SessionTerminationCode,
} from "../../review/index.js";
import type { ReviewContextResponse } from "../types.js";
import { useSettings } from "./config.js";
import { useReviewContext } from "./review.js";
import { useReviewCompletion } from "./use-review-completion.js";
import { useReviewStart } from "./use-review-start.js";
import type { ReviewStreamState } from "./use-review-stream.js";
import { useReviewStream } from "./use-review-stream.js";

/**
 * The gate a review screen is currently behind, computed in the canonical order
 * shared by both surfaces: still loading config/changes, provider unconfigured,
 * no diff to review, otherwise the live run.
 */
export type ReviewGate = "loading" | "unconfigured" | "no-diff" | "running";

export interface UseReviewLifecycleBaseOptions {
  configLoading: boolean;
  isConfigured: boolean;
  reviewId?: string;
  onComplete: () => void;
  onNotFoundInSession?: (reviewId: string) => void;
  onStaleSession?: (code: SessionTerminationCode) => void;
}

export interface UseReviewLifecycleBaseResult {
  stream: {
    stop: () => void;
    abort: () => void;
    cancel: (reviewId: string | null) => Promise<string | null>;
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

  gate: ReviewGate;
  contextReady: boolean;
  contextSnapshot: ReviewContextResponse | null;
}

export function deriveReviewGate(input: {
  loadingMessage: string | null;
  isConfigured: boolean;
  isNoDiffError: boolean;
}): ReviewGate {
  if (input.loadingMessage) return "loading";
  if (!input.isConfigured) return "unconfigured";
  if (input.isNoDiffError) return "no-diff";
  return "running";
}

export function useReviewLifecycleBase(
  options: UseReviewLifecycleBaseOptions,
): UseReviewLifecycleBaseResult {
  const stream = useReviewStream();
  const { isLoading: settingsLoading } = useSettings();

  const { hasStarted, hasStreamed, setHasStarted, setHasStreamed } = useReviewStart({
    configLoading: options.configLoading,
    settingsLoading,
    isConfigured: options.isConfigured,
    reviewId: options.reviewId,
    currentReviewId: stream.state.reviewId,
    resume: stream.resume,
    onNotFoundInSession: options.onNotFoundInSession,
    onStaleSession: options.onStaleSession,
  });

  const {
    isCompleting,
    skipDelay,
    reset: resetCompletion,
  } = useReviewCompletion({
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

  const contextStep = stream.state.steps.find((step) => step.id === "context");
  const contextReady = contextStep?.status === "completed" && !!stream.state.reviewId;
  const { data: contextData } = useReviewContext({
    enabled: contextReady,
    reviewId: stream.state.reviewId,
  });
  const contextSnapshot = contextReady ? (contextData ?? null) : null;

  const gate = deriveReviewGate({
    loadingMessage,
    isConfigured: options.isConfigured,
    isNoDiffError,
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
    gate,
    contextReady,
    contextSnapshot,
  };
}
