import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  isCheckingForChanges as checkForChanges,
  isNoDiffError as checkNoDiffError,
  getLoadingMessage,
  type SessionTerminationCode,
} from "../../review/lifecycle.js";
import type { ConfigurationId } from "../../schemas/config/index.js";
import type { Readiness } from "../../schemas/config/readiness.js";
import { ReviewErrorCode } from "../../schemas/review/index.js";
import type { ReviewContextResponse } from "../types.js";
import { useSettings } from "./config.js";
import { useApi } from "./context.js";
import type { ConfigurationFingerprint } from "./queries/config.js";
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

export interface ReviewConfigurationIdentity {
  configurationId: ConfigurationId;
  fingerprint: ConfigurationFingerprint;
}

/**
 * Distinct non-ready readiness reasons surfaced to review start/resume gates.
 * These stay separate from legacy API-key-only setup copy.
 */
export type ReviewReadinessGateReason =
  | "unreachable"
  | "conformance-pending"
  | "unsupported"
  | "skipped"
  | "not-ready";

export interface UseReviewLifecycleBaseOptions {
  configLoading: boolean;
  /**
   * Legacy setup flag retained while Web/Ink callers migrate to `readiness`.
   * When `readiness` is present it wins over this value.
   */
  isConfigured: boolean;
  readiness?: Readiness | null;
  configuration?: ReviewConfigurationIdentity | null;
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
    canStart: boolean;
    identity: ReviewConfigurationIdentity | null;
    readinessGate: ReviewReadinessGateReason | "ready";
  };

  reset: () => void;

  gate: ReviewGate;
  contextSnapshot: ReviewContextResponse | null;
}

export function resolveReviewReadinessGate(
  readiness: Readiness | null | undefined,
): ReviewReadinessGateReason | "ready" {
  if (readiness?.ready) return "ready";

  switch (readiness?.status) {
    case "unreachable":
    case "local-endpoint-unreachable":
      return "unreachable";
    case "conformance-pending":
      return "conformance-pending";
    case "unsupported":
      return "unsupported";
    case "skipped":
      return "skipped";
    default:
      return "not-ready";
  }
}

export function resolveReviewStartReady(input: {
  readiness?: Readiness | null;
  isConfigured: boolean;
}): boolean {
  if (input.readiness != null) return input.readiness.ready;
  return input.isConfigured;
}

export function canStartReview(input: {
  readiness?: Readiness | null;
  isConfigured: boolean;
  allowResumeWithoutSetup?: boolean;
}): boolean {
  if (input.allowResumeWithoutSetup) return true;
  return resolveReviewStartReady(input);
}

export function buildReviewStartIdentity(
  configuration: ReviewConfigurationIdentity,
): ReviewConfigurationIdentity {
  return {
    configurationId: configuration.configurationId,
    fingerprint: configuration.fingerprint,
  };
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
  const isReady = resolveReviewStartReady({
    readiness: options.readiness,
    isConfigured: options.isConfigured,
  });
  const isSetupSatisfied = canStartReview({
    readiness: options.readiness,
    isConfigured: options.isConfigured,
    allowResumeWithoutSetup,
  });
  const readinessGate = resolveReviewReadinessGate(options.readiness);
  const startIdentity = options.configuration
    ? buildReviewStartIdentity(options.configuration)
    : null;

  const { hasStarted, hasStreamed, setHasStarted, setHasStreamed } = useReviewStart({
    configLoading: options.configLoading,
    settingsLoading,
    isConfigured: isReady,
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

  const reset = () => {
    stream.abort();
    resetCompletion();
    setHasStarted(false);
    setHasStreamed(false);
  };

  const gate = deriveReviewGate({
    loadingMessage,
    isConfigured: isSetupSatisfied,
    isNoDiffError,
    isTerminalStreamError,
  });

  return {
    stream,
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
      canStart: isSetupSatisfied,
      identity: startIdentity,
      readinessGate,
    },
    reset,
    gate,
    contextSnapshot,
  };
}
