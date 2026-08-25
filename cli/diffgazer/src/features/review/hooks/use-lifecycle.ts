import type { BoundApi } from "@diffgazer/core/api";
import type { ReviewGate, UseReviewLifecycleBaseResult } from "@diffgazer/core/api/hooks";
import {
  useApi,
  useConfigurationInit,
  useCreateReview,
  useReviewLifecycleBase,
  useReviewSessionCache,
} from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import { getProviderDisplay, PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type {
  FileProgress,
  OrchestratorStats,
  ReviewEvent,
  ReviewScreenPhase,
} from "@diffgazer/core/review";
import {
  describeReviewStartError,
  type ReviewStartErrorDescription,
  sessionTerminationCopy,
} from "@diffgazer/core/review";
import type { ProviderConsent, Readiness, TransportFamily } from "@diffgazer/core/schemas/config";
import {
  canAttemptReview,
  READINESS_PRESENTATION,
  ReadinessSchema,
  resolveSelectedConfiguration,
} from "@diffgazer/core/schemas/config";
import type { AgentState, StepState } from "@diffgazer/core/schemas/events";
import type { ReviewIssue, ReviewMode, ReviewSizeWarning } from "@diffgazer/core/schemas/review";
import { useEffect, useState } from "react";

type LifecyclePhase = ReviewScreenPhase | "completing" | "loading";
type ReviewInitState =
  | { status: "loading" }
  | { status: "error"; message: string; error: unknown }
  | { status: "ready"; readiness: Readiness };

type ReviewStartResult = "started" | "setup-required" | "failed";

export interface ReviewStartOptions {
  /**
   * Repo-relative paths the run is narrowed to. The review keeps its staged or
   * unstaged scope and reads only these files — `mode: "files"` is deliberately
   * not used, because the server diffs that mode against the working tree and
   * would silently turn a staged review into an unstaged one.
   */
  files?: string[];
  /**
   * Create a review even when the resumed run could be replayed instead. The
   * picker always starts something new, including when every reviewable file is
   * selected and there is no `files[]` to narrow with.
   */
  fresh?: boolean;
}

export function getDisplayPhase(input: {
  hasStartFailed: boolean;
  hasStarted: boolean;
  isCompleting: boolean;
  phase: ReviewScreenPhase;
}): LifecyclePhase {
  if (input.hasStartFailed) return "summary";
  if (!input.hasStarted) return "loading";
  if (input.isCompleting) return "completing";
  return input.phase;
}

async function readActiveReviewId(api: BoundApi, mode: ReviewMode): Promise<string | null> {
  try {
    const { session } = await api.getActiveReviewSession(mode);
    return session?.reviewId ?? null;
  } catch {
    return null;
  }
}

function unconfiguredReadiness(): Readiness {
  return ReadinessSchema.parse({
    status: "unconfigured",
    ready: false,
    evidenceStatus: "not-checked",
    checkedAt: null,
    acknowledgement: { status: "not-applicable" },
    ...READINESS_PRESENTATION.unconfigured,
  });
}

export interface ReviewLifecycleState {
  phase: LifecyclePhase;
  gate: ReviewGate;
  contextSnapshot: UseReviewLifecycleBaseResult["contextSnapshot"];
  contextRefreshError: UseReviewLifecycleBaseResult["contextRefreshError"];
  retryContextRefresh: UseReviewLifecycleBaseResult["retryContextRefresh"];
  /** Never `"files"`: the TUI narrows a run with `files[]`, keeping its staged/unstaged scope. */
  mode: Exclude<ReviewMode, "files">;
  reviewId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  issues: ReviewIssue[];
  steps: StepState[];
  agents: AgentState[];
  events: ReviewEvent[];
  completion: OrchestratorStats;
  fileProgress: FileProgress;
  notices: string[];
  /**
   * The run was admitted, but its diff is large enough that one pass reads it
   * poorly. Advisory only — the review is already running.
   */
  sizeWarning: ReviewSizeWarning | null;
  error: string | null;
  errorCode: string | null;
  /** The session request was refused; `error` carries the same text for the summary. */
  startError: ReviewStartErrorDescription | null;
  isStreaming: boolean;
  provider: string | null;
  productLabel: string | null;
  /** "Provider / model" identity of the selected configuration, for gate metadata. */
  configurationDisplay: string | null;
  transportFamily: TransportFamily | null;
  readiness: Readiness;
  /** The recorded provider consent; null until accepted, or while init is still loading. */
  providerConsent: ProviderConsent | null;
  initState: ReviewInitState;
  loadingMessage: string | null;
  /** The run is admitted, so the progress screen may carry its start itself. */
  canStart: boolean;
}

interface UseReviewLifecycleOptions {
  mode?: Exclude<ReviewMode, "files">;
  reviewId?: string;
  allowResumeWithoutSetup?: boolean;
  onStreamNotFound?: (reviewId: string) => void;
}

export function useReviewLifecycle(options: UseReviewLifecycleOptions = {}): {
  state: ReviewLifecycleState;
  start: (
    mode: Exclude<ReviewMode, "files">,
    options?: ReviewStartOptions,
  ) => Promise<ReviewStartResult>;
  cancel: () => Promise<string | null>;
  goToSummary: () => void;
  goToResults: () => void;
  retryConfig: () => Promise<void>;
  reset: (options?: { clearActiveSession?: boolean }) => void;
} {
  const api = useApi();
  const initQuery = useConfigurationInit();
  const initData = initQuery.data;
  const createReview = useCreateReview();
  const { clearActiveSession: clearCachedActiveSession } = useReviewSessionCache();
  const [mode, setMode] = useState<Exclude<ReviewMode, "files">>(options.mode ?? "staged");
  const [startedReviewId, setStartedReviewId] = useState<string | undefined>();
  const [phase, setPhase] = useState<ReviewScreenPhase>("streaming");
  const [startError, setStartError] = useState<ReviewStartErrorDescription | null>(null);
  const requestedReviewId = startedReviewId ?? options.reviewId;

  const selectedStatus = resolveSelectedConfiguration(initData);
  const readiness = selectedStatus?.readiness ?? unconfiguredReadiness();
  const productLabel = selectedStatus
    ? PRODUCT_REGISTRY[selectedStatus.configuration.productId].presentation.name
    : null;
  const configurationDisplay = selectedStatus
    ? getProviderDisplay(
        selectedStatus.configuration.productId,
        selectedStatus.configuration.selectedModelId ?? undefined,
      )
    : null;
  const transportFamily = selectedStatus?.configuration.transportFamily ?? null;
  const provider = selectedStatus?.configuration.productId ?? null;

  let initState: ReviewInitState;
  if (initData) {
    initState = { status: "ready", readiness };
  } else if (initQuery.isLoading || initQuery.isFetching) {
    initState = { status: "loading" };
  } else {
    initState = {
      status: "error",
      message: getErrorMessage(initQuery.error, "Unable to load configuration."),
      error: initQuery.error,
    };
  }

  function clearActiveSessionForReview(reviewId: string | null | undefined) {
    if (reviewId) {
      clearCachedActiveSession(mode, reviewId);
    }
  }

  const lifecycle = useReviewLifecycleBase({
    configLoading: initState.status === "loading",
    readiness,
    allowResumeWithoutSetup: options.allowResumeWithoutSetup,
    reviewId: requestedReviewId,
    onStreamComplete: () => {
      clearActiveSessionForReview(requestedReviewId);
    },
    onComplete: () => {
      clearActiveSessionForReview(requestedReviewId);
      setPhase("summary");
    },
    onNotFoundInSession: (reviewId) => {
      clearActiveSessionForReview(reviewId);
      if (options.onStreamNotFound) {
        options.onStreamNotFound(reviewId);
      } else {
        setStartError({
          title: "Review Not Found",
          message: "Review session not found.",
          recovery: null,
        });
      }
    },
    onStaleSession: (code) => {
      clearActiveSessionForReview(requestedReviewId);
      setStartError({ ...sessionTerminationCopy(code), recovery: null });
    },
  });

  const terminalReviewId = lifecycle.stream.state.reviewId ?? requestedReviewId ?? null;
  const completion = lifecycle.stream.state.orchestratorStats;

  useEffect(() => {
    if (lifecycle.checks.isNoDiffError && terminalReviewId) {
      clearCachedActiveSession(mode, terminalReviewId);
    }
  }, [clearCachedActiveSession, lifecycle.checks.isNoDiffError, mode, terminalReviewId]);

  const hasStartFailed = startError !== null;
  const displayPhase = getDisplayPhase({
    hasStartFailed,
    hasStarted: lifecycle.start.hasStarted,
    isCompleting: lifecycle.completion.isCompleting,
    phase,
  });

  async function start(
    selectedMode: Exclude<ReviewMode, "files">,
    startOptions: ReviewStartOptions = {},
  ): Promise<ReviewStartResult> {
    const files = startOptions.files;
    if (lifecycle.gate === "unconfigured" && !options.allowResumeWithoutSetup) {
      return "setup-required";
    }
    if (selectedMode !== mode && !canAttemptReview(readiness.status)) {
      return "setup-required";
    }
    // A run started from the picker is a different review than the one being
    // resumed — narrowed or not — so it never takes the replay branch below.
    if (
      !files &&
      !startOptions.fresh &&
      options.reviewId &&
      options.allowResumeWithoutSetup &&
      selectedMode === mode
    ) {
      setMode(selectedMode);
      setStartError(null);
      setStartedReviewId(undefined);
      lifecycle.reset();
      setPhase("streaming");
      return "started";
    }
    if (!lifecycle.start.canStart) {
      return "setup-required";
    }
    setMode(selectedMode);
    setStartError(null);
    setStartedReviewId(undefined);
    lifecycle.reset();
    setPhase("streaming");
    try {
      const result = await createReview.mutateAsync({
        mode: selectedMode,
        ...(files ? { files } : {}),
      });
      setStartedReviewId(result.reviewId);
      return "started";
    } catch (err) {
      const description = describeReviewStartError(err);
      if (description.recovery === "open-active-review") {
        // The refused start already has a run: resume its stream instead of
        // rendering the terminal error view.
        const activeReviewId = await readActiveReviewId(api, selectedMode);
        if (activeReviewId) {
          setStartedReviewId(activeReviewId);
          return "started";
        }
      }
      setStartError(description);
      return "failed";
    }
  }

  async function cancel(): Promise<string | null> {
    const reviewId = lifecycle.stream.state.reviewId ?? requestedReviewId ?? null;
    const outcome = await lifecycle.stream.cancel(reviewId);
    if (!outcome || outcome.status === "cancelled") {
      clearActiveSessionForReview(reviewId);
      return null;
    }
    return outcome.message;
  }

  function goToSummary() {
    // Skipping only shortens a running completion delay; the phase move is what
    // actually shows the summary, so returning here from results works too.
    lifecycle.completion.skipDelay();
    setPhase("summary");
  }

  function goToResults() {
    setPhase("results");
  }

  async function retryConfig(): Promise<void> {
    await initQuery.refetch();
  }

  function reset(options: { clearActiveSession?: boolean } = {}) {
    if (options.clearActiveSession) {
      clearActiveSessionForReview(terminalReviewId);
    }
    setStartError(null);
    lifecycle.reset();
    setPhase("streaming");
    setStartedReviewId(undefined);
  }

  const state: ReviewLifecycleState = {
    phase: displayPhase,
    gate: lifecycle.gate,
    contextSnapshot: lifecycle.contextSnapshot,
    contextRefreshError: lifecycle.contextRefreshError,
    retryContextRefresh: lifecycle.retryContextRefresh,
    mode,
    reviewId: lifecycle.stream.state.reviewId ?? requestedReviewId ?? null,
    startedAt: lifecycle.stream.state.startedAt,
    completedAt: lifecycle.completion.completedAt,
    issues: lifecycle.stream.state.issues,
    steps: lifecycle.stream.state.steps,
    agents: lifecycle.stream.state.agents,
    events: lifecycle.stream.state.events,
    completion,
    fileProgress: lifecycle.stream.state.fileProgress,
    notices: lifecycle.stream.state.notices,
    sizeWarning: lifecycle.stream.state.sizeWarning,
    error: startError ? `${startError.title}: ${startError.message}` : lifecycle.stream.state.error,
    errorCode: startError ? null : lifecycle.stream.state.errorCode,
    startError,
    isStreaming: lifecycle.stream.state.isStreaming,
    provider,
    productLabel,
    configurationDisplay,
    transportFamily,
    readiness,
    providerConsent: initData?.settings.providerConsent ?? null,
    initState,
    loadingMessage: lifecycle.checks.loadingMessage,
    canStart: lifecycle.start.canStart,
  };

  return { state, start, cancel, goToSummary, goToResults, retryConfig, reset };
}
