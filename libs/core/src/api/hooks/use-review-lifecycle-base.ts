import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Result } from "../../result.js";
import {
  isCheckingForChanges as checkForChanges,
  isNoDiffError as checkNoDiffError,
  getLoadingMessage,
  type SessionTerminationCode,
  type StreamReviewError,
} from "../../review/index.js";
import { ReviewErrorCode } from "../../schemas/review/index.js";
import type { ReviewContextResponse } from "../types.js";
import { useSettings } from "./config.js";
import { useApi } from "./context.js";
import { refreshReviewContextCache } from "./queries/review.js";
import { useReviewContext } from "./review.js";
import { useReviewCompletion } from "./use-review-completion.js";
import { useReviewStart } from "./use-review-start.js";
import type { CancelReviewOptions, ReviewStreamState } from "./use-review-stream.js";
import { useReviewStream } from "./use-review-stream.js";

/**
 * The gate a review screen is currently behind, computed in the canonical order
 * shared by both surfaces.
 */
export type ReviewGate = "loading" | "unconfigured" | "no-diff" | "terminal-error" | "running";

export interface UseReviewLifecycleBaseOptions {
  configLoading: boolean;
  isConfigured: boolean;
  allowResumeWithoutSetup?: boolean;
  reviewId?: string;
  onComplete: () => void;
  onStreamComplete?: () => void;
  onNotFoundInSession?: (reviewId: string) => void;
  onStaleSession?: (code: SessionTerminationCode) => void;
}

export interface UseReviewLifecycleBaseResult {
  stream: {
    stop: () => void;
    abort: () => void;
    cancel: (reviewId: string | null, options?: CancelReviewOptions) => Promise<string | null>;
    resume: (reviewId: string) => Promise<Result<void, StreamReviewError>>;
    state: ReviewStreamState;
  };

  checks: {
    isNoDiffError: boolean;
    isTerminalStreamError: boolean;
    isCheckingForChanges: boolean;
    loadingMessage: string | null;
  };

  completion: {
    isCompleting: boolean;
    completedAt: Date | null;
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
  isTerminalStreamError?: boolean;
}): ReviewGate {
  if (input.loadingMessage) return "loading";
  if (input.isTerminalStreamError) return "terminal-error";
  if (!input.isConfigured) return "unconfigured";
  if (input.isNoDiffError) return "no-diff";
  return "running";
}

function hasTerminalStreamError(state: ReviewStreamState): boolean {
  return !state.isStreaming && state.error !== null && state.errorCode !== ReviewErrorCode.NO_DIFF;
}

export function useReviewLifecycleBase(
  options: UseReviewLifecycleBaseOptions,
): UseReviewLifecycleBaseResult {
  const api = useApi();
  const queryClient = useQueryClient();
  const stream = useReviewStream();
  const { isLoading: settingsLoading } = useSettings();
  const allowResumeWithoutSetup = Boolean(options.reviewId && options.allowResumeWithoutSetup);
  const isSetupSatisfied = options.isConfigured || allowResumeWithoutSetup;

  const { hasStarted, hasStreamed, setHasStarted, setHasStreamed } = useReviewStart({
    configLoading: options.configLoading,
    settingsLoading,
    isConfigured: options.isConfigured,
    allowResumeWithoutSetup,
    reviewId: options.reviewId,
    currentReviewId: stream.state.reviewId,
    resume: stream.resume,
    onNotFoundInSession: options.onNotFoundInSession,
    onStaleSession: options.onStaleSession,
  });

  const {
    isCompleting,
    completedAt,
    skipDelay,
    reset: resetCompletion,
  } = useReviewCompletion({
    isStreaming: stream.state.isStreaming,
    isComplete: stream.state.hasCompleted,
    error: stream.state.error,
    errorCode: stream.state.errorCode,
    hasStreamed,
    steps: stream.state.steps,
    onComplete: options.onComplete,
    onStreamComplete: options.onStreamComplete,
  });

  const isNoDiffError = checkNoDiffError(stream.state.errorCode);
  const isTerminalStreamError = hasTerminalStreamError(stream.state);
  const isCheckingForChanges = checkForChanges(stream.state.isStreaming, stream.state.steps);
  const isInitializing = !hasStarted && isSetupSatisfied && !options.configLoading;

  const loadingMessage = getLoadingMessage({
    configLoading: options.configLoading,
    settingsLoading,
    isCheckingForChanges,
    isInitializing,
  });

  const contextStep = stream.state.steps.find((step) => step.id === "context");
  const contextReviewId =
    contextStep?.status === "completed" ? (stream.state.reviewId ?? null) : null;
  const contextReady = contextReviewId !== null;
  const { data: contextData } = useReviewContext({
    enabled: false,
  });
  const [refreshedContextReviewId, setRefreshedContextReviewId] = useState<string | null>(null);

  useEffect(() => {
    if (!contextReviewId) return;
    let isCurrent = true;

    void (async () => {
      await refreshReviewContextCache(queryClient, api);
      if (isCurrent) setRefreshedContextReviewId(contextReviewId);
    })().catch(() => {
      if (isCurrent) setRefreshedContextReviewId(null);
    });

    return () => {
      isCurrent = false;
    };
  }, [api, contextReviewId, queryClient]);

  const contextSnapshot =
    contextReviewId === refreshedContextReviewId ? (contextData ?? null) : null;

  const gate = deriveReviewGate({
    loadingMessage,
    isConfigured: isSetupSatisfied,
    isNoDiffError,
    isTerminalStreamError,
  });

  return {
    stream: {
      stop: stream.stop,
      abort: stream.abort,
      cancel: stream.cancel,
      resume: stream.resume,
      state: stream.state,
    },
    checks: {
      isNoDiffError,
      isTerminalStreamError,
      isCheckingForChanges,
      loadingMessage,
    },
    completion: {
      isCompleting,
      completedAt,
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
