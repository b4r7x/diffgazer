import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { getErrorMessage } from "../../errors.js";
import {
  isCheckingForChanges as checkForChanges,
  isNoDiffError as checkNoDiffError,
  getLoadingMessage,
  isSessionTerminationCode,
  type SessionTerminationCode,
} from "../../review/lifecycle.js";
import type { StreamReviewError } from "../../review/stream.js";
import { canAttemptReview, type Readiness } from "../../schemas/config/readiness.js";
import { ReviewErrorCode } from "../../schemas/review/index.js";
import type { ReviewContextResponse } from "../types.js";
import { useSettings } from "./config.js";
import { useApi } from "./context.js";
import { refreshReviewContextCache } from "./queries/review.js";
import { useReviewContext } from "./review.js";
import { useReviewCompletion } from "./use-review-completion.js";
import { useReviewStart } from "./use-review-start.js";
import type { ReviewStreamState, UseReviewStreamResult } from "./use-review-stream.js";
import { useReviewStream } from "./use-review-stream.js";

/**
 * The gate a review screen is currently behind, computed in the canonical order
 * shared by both surfaces.
 */
export type ReviewGate = "loading" | "unconfigured" | "no-diff" | "terminal-error" | "running";

export interface UseReviewLifecycleBaseOptions {
  configLoading: boolean;
  /**
   * The selected configuration's readiness, or `null` when no configuration is
   * selected. This is the only setup input the review gate reads.
   */
  readiness: Readiness | null;
  allowResumeWithoutSetup?: boolean;
  reviewId?: string;
  onComplete: () => void;
  onStreamComplete?: () => void;
  onNotFoundInSession?: (reviewId: string) => void;
  onStaleSession?: (code: SessionTerminationCode) => void;
}

export interface UseReviewLifecycleBaseResult {
  stream: UseReviewStreamResult;

  checks: {
    isNoDiffError: boolean;
    isTerminalStreamError: boolean;
    loadingMessage: string | null;
  };

  completion: {
    isCompleting: boolean;
    completedAt: Date | null;
    skipDelay: () => void;
  };

  start: {
    hasStarted: boolean;
    canStart: boolean;
  };

  reset: () => void;
  resumeReview: (reviewId: string) => ReturnType<UseReviewStreamResult["resume"]>;

  gate: ReviewGate;
  contextSnapshot: ReviewContextResponse | null;
  contextRefreshError: string | null;
  retryContextRefresh: () => void;
}

export function canStartReview(input: {
  readiness: Readiness | null;
  allowResumeWithoutSetup?: boolean;
}): boolean {
  if (input.allowResumeWithoutSetup) return true;
  return input.readiness ? canAttemptReview(input.readiness.status) : false;
}

export function deriveReviewGate(input: {
  loadingMessage: string | null;
  canStart: boolean;
  isNoDiffError: boolean;
  isTerminalStreamError?: boolean;
}): ReviewGate {
  if (input.loadingMessage) return "loading";
  if (input.isTerminalStreamError) return "terminal-error";
  if (!input.canStart) return "unconfigured";
  if (input.isNoDiffError) return "no-diff";
  return "running";
}

function hasTerminalStreamError(state: ReviewStreamState): boolean {
  return (
    !state.isStreaming &&
    state.error !== null &&
    state.errorCode !== ReviewErrorCode.NO_DIFF &&
    state.errorCode !== "STREAM_ERROR"
  );
}

function handleResumeError(
  reviewId: string,
  error: StreamReviewError,
  options: Pick<UseReviewLifecycleBaseOptions, "onNotFoundInSession" | "onStaleSession">,
) {
  if (isSessionTerminationCode(error.code)) {
    options.onStaleSession?.(error.code);
  } else if (error.code === ReviewErrorCode.SESSION_NOT_FOUND) {
    options.onNotFoundInSession?.(reviewId);
  }
}

export function useReviewLifecycleBase(
  options: UseReviewLifecycleBaseOptions,
): UseReviewLifecycleBaseResult {
  const api = useApi();
  const queryClient = useQueryClient();
  const stream = useReviewStream();
  const { isLoading: settingsLoading } = useSettings();
  const mountedRef = useRef(true);
  const allowResumeWithoutSetup = Boolean(options.reviewId && options.allowResumeWithoutSetup);
  const canStart = canStartReview({
    readiness: options.readiness,
    allowResumeWithoutSetup,
  });

  const resumeReview = async (reviewId: string) => {
    const result = await stream.resume(reviewId);
    if (!result.ok && mountedRef.current) {
      handleResumeError(reviewId, result.error, options);
    }
    return result;
  };

  const { status: startStatus, reset: resetStart } = useReviewStart({
    configLoading: options.configLoading,
    settingsLoading,
    isConfigured: canStart,
    allowResumeWithoutSetup,
    reviewId: options.reviewId,
    currentReviewId: stream.state.reviewId,
    resume: stream.resume,
    onNotFoundInSession: options.onNotFoundInSession,
    onStaleSession: options.onStaleSession,
  });
  const hasStarted = startStatus !== "idle";
  const hasStreamed = startStatus === "streaming";

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
  const isInitializing = !hasStarted && canStart && !options.configLoading;

  const loadingMessage = getLoadingMessage({
    configLoading: options.configLoading,
    settingsLoading,
    isCheckingForChanges,
    isInitializing,
  });

  const contextStep = stream.state.steps.find((step) => step.id === "context");
  const contextReviewId =
    contextStep?.status === "completed" ? (stream.state.reviewId ?? null) : null;
  const { data: contextData } = useReviewContext({
    enabled: false,
  });
  const [refreshedContextReviewId, setRefreshedContextReviewId] = useState<string | null>(null);
  const [contextRefreshError, setContextRefreshError] = useState<string | null>(null);
  const [contextRefreshAttempt, setContextRefreshAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: contextRefreshAttempt is never read in the body; it is the intentional retry re-trigger bumped by retryContextRefresh. Dropping it stops retryContextRefresh from re-running the refresh.
  useEffect(() => {
    if (!contextReviewId) return;
    let isCurrent = true;

    void (async () => {
      try {
        await refreshReviewContextCache(queryClient, api);
        if (isCurrent) {
          setRefreshedContextReviewId(contextReviewId);
          setContextRefreshError(null);
        }
      } catch (error) {
        if (isCurrent) {
          setRefreshedContextReviewId(null);
          setContextRefreshError(
            getErrorMessage(error, "Failed to refresh the review context snapshot."),
          );
        }
      }
    })();

    return () => {
      isCurrent = false;
    };
  }, [api, contextReviewId, contextRefreshAttempt, queryClient]);

  const retryContextRefresh = () => {
    setContextRefreshAttempt((attempt) => attempt + 1);
  };

  const contextSnapshot =
    contextReviewId === refreshedContextReviewId ? (contextData ?? null) : null;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reset = () => {
    stream.abort();
    resetCompletion();
    resetStart();
  };

  const reconnectAfterTransportError = useEffectEvent(() => {
    const reviewId = stream.state.reviewId;
    if (
      !reviewId ||
      stream.state.isStreaming ||
      stream.isStreamControllerActive() ||
      stream.state.errorCode !== "STREAM_ERROR"
    ) {
      return;
    }
    void resumeReview(reviewId);
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const reconnect = () => reconnectAfterTransportError();
    const reconnectWhenVisible = () => {
      if (document.visibilityState === "visible") reconnect();
    };

    window.addEventListener("online", reconnect);
    document.addEventListener("visibilitychange", reconnectWhenVisible);
    return () => {
      window.removeEventListener("online", reconnect);
      document.removeEventListener("visibilitychange", reconnectWhenVisible);
    };
  }, []);

  const gate = deriveReviewGate({
    loadingMessage,
    canStart,
    isNoDiffError,
    isTerminalStreamError,
  });

  return {
    stream,
    checks: {
      isNoDiffError,
      isTerminalStreamError,
      loadingMessage,
    },
    completion: {
      isCompleting,
      completedAt,
      skipDelay,
    },
    start: {
      hasStarted,
      canStart,
    },
    reset,
    resumeReview,
    gate,
    contextSnapshot,
    contextRefreshError,
    retryContextRefresh,
  };
}
