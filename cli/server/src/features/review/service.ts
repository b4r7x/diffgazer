import { createHash, randomUUID } from "node:crypto";
import type { Result } from "@diffgazer/core/result";
import { err, ok } from "@diffgazer/core/result";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { FullReviewStreamEvent, StepId } from "@diffgazer/core/schemas/events";
import {
  type CreateReviewOutcome,
  ReviewErrorCode,
  type ReviewIssue,
  type ReviewMode,
} from "@diffgazer/core/schemas/review";
import type { InitializedAIClient } from "../../shared/lib/ai/client/initialize.js";
import type { AIClient } from "../../shared/lib/ai/types.js";
import { getStore } from "../../shared/lib/config/store.js";
import { createGitService } from "../../shared/lib/git/service.js";
import { log } from "../../shared/lib/log.js";
import { activateSessionForProject } from "../../shared/lib/session-registry.js";
import { isReviewAbort, type ReviewAbort } from "./abort.js";
import { evaluateReviewCapacity, type ReviewCapacityPlan } from "./capacity.js";
import { recordConformanceEvidence } from "./conformance-evidence.js";
import { resolveGitDiff } from "./diff.js";
import type { ParsedDiff } from "./engine/diff/types.js";
import { deduplicateIssues, orderIssuesDeterministic } from "./engine/issues/ordering.js";
import {
  executeReview,
  finalizeReview,
  resolveReviewConfig,
  resolveReviewDefaults,
} from "./pipeline.js";
import { saveReview } from "./storage/reviews.js";
import { isAbortError, normalizeReviewStreamError, reviewStreamError } from "./stream/events.js";
import { buildReviewConfigKey, buildScopeKey } from "./stream/scope-keys.js";
import { stepError } from "./stream/steps.js";
import {
  type ActiveSession,
  addEvent,
  cancelStaleSessionsForProjectMode,
  createSession,
  getActiveSessionForProject,
  getSession,
  markCommitted,
  markCommitting,
  markComplete,
  markReady,
} from "./stream/store.js";
import type {
  EmitFn,
  ResolvedReviewDefaults,
  ReviewExecutionContext,
  StreamReviewParams,
} from "./types.js";
import { createReviewExecutionContext } from "./types.js";

/** Logs per-step latency from the review stream so each phase is observable. */
function logStepTiming(
  event: FullReviewStreamEvent,
  reviewId: string,
  startedAt: Map<StepId, number>,
): void {
  if (event.type === "step_start") {
    startedAt.set(event.step, performance.now());
    return;
  }
  if (event.type === "step_complete" || event.type === "step_error") {
    const started = startedAt.get(event.step);
    if (started === undefined) return;
    startedAt.delete(event.step);
    log(event.type === "step_error" ? "warn" : "info", "review_step", {
      reviewId,
      step: event.step,
      status: event.type === "step_error" ? "error" : "complete",
      durationMs: Math.round((performance.now() - started) * 1000) / 1000,
    });
  }
}

async function handleReviewFailure(
  error: unknown,
  emit: EmitFn,
  reviewId: string,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted || isAbortError(error)) {
    markComplete(reviewId);
    return;
  }

  if (isReviewAbort(error)) {
    const normalized = normalizeReviewStreamError(error, undefined, { reviewId });
    if (error.step) {
      await emit(stepError(error.step, normalized.message));
    }
    await emit(reviewStreamError(normalized.message, normalized.code));
    markComplete(reviewId);
    return;
  }

  const normalized = normalizeReviewStreamError(error, undefined, { reviewId });
  await emit(reviewStreamError(normalized.message, normalized.code));
  markComplete(reviewId);
}

function handleDetachedReviewSessionError(reviewId: string, error: unknown): void {
  const session = getSession(reviewId);
  if (!session || session.isComplete) {
    return;
  }

  const normalized = normalizeReviewStreamError(error, undefined, { reviewId });
  addEvent(reviewId, reviewStreamError(normalized.message, normalized.code));
  markComplete(reviewId);
}

function resolveCreateOutcome(start: Result<unknown, ReviewAbort>): CreateReviewOutcome {
  if (start.ok) return "running";
  return start.error.code === ReviewErrorCode.NO_DIFF ? "no-diff" : "failed";
}

type ReviewStart = { parsed: ParsedDiff; capacity: ReviewCapacityPlan };

/**
 * The size gate only has something to judge once the diff parsed, and a review
 * that fails either step starts nowhere — so both answers travel as one result.
 */
function planReviewStart(
  parsedResult: Result<ParsedDiff, ReviewAbort>,
  evaluate: (parsed: ParsedDiff) => Result<ReviewCapacityPlan, ReviewAbort>,
): Result<ReviewStart, ReviewAbort> {
  if (!parsedResult.ok) return parsedResult;
  const capacity = evaluate(parsedResult.value);
  if (!capacity.ok) return capacity;
  return ok({ parsed: parsedResult.value, capacity: capacity.value });
}

export interface CreateReviewSessionResult {
  reviewId: string;
  session: ActiveSession;
  outcome: CreateReviewOutcome;
}

export function buildReviewInputHash(params: {
  headCommit: string;
  reviewConfigKey: string;
  parsed: ParsedDiff;
}): string {
  const files = params.parsed.files.map((file) => [file.filePath, file.previousPath, file.rawDiff]);
  return createHash("sha256")
    .update(JSON.stringify([params.headCommit, params.reviewConfigKey, files]), "utf8")
    .digest("hex");
}

function recordReviewEvent(
  reviewId: string,
  event: FullReviewStreamEvent,
  stepStartedAt: Map<StepId, number>,
): void {
  logStepTiming(event, reviewId, stepStartedAt);
  addEvent(reviewId, event);
}

/**
 * Writes what an interrupted review already produced. `finalizeReview` is the
 * only other writer, and both claim the session's commit state first, so a
 * termination racing the pipeline's own save cannot write the run twice.
 */
async function persistPartialReview(params: {
  reviewId: string;
  projectPath: string;
  mode: ReviewMode;
  issues: readonly ReviewIssue[];
  parsed: ParsedDiff | null;
  branch: string | null;
  headCommit: string;
  lenses: ResolvedReviewDefaults["activeLenses"];
  profileId: ResolvedReviewDefaults["effectiveProfileId"];
  elapsedStart: number;
}): Promise<void> {
  // A run that streamed nothing has nothing to lose, and an empty record would
  // only fill history with runs the user cannot read.
  if (!params.parsed || params.issues.length === 0) return;
  if (!markCommitting(params.reviewId)) return;

  const saved = await saveReview({
    reviewId: params.reviewId,
    projectPath: params.projectPath,
    mode: params.mode,
    // Streamed issues arrive per lens, per batch — the aggregation a completed
    // run gets in orchestrate has not happened yet, so apply it here too.
    result: { issues: orderIssuesDeterministic(deduplicateIssues([...params.issues])) },
    diff: params.parsed,
    branch: params.branch,
    commit: params.headCommit,
    lenses: params.lenses,
    durationMs: Math.round(performance.now() - params.elapsedStart),
    // Every termination lands here as "cancelled" — eviction, idle timeout and
    // shutdown included. Deliberate: the enum's "timed-out" names a dispatch
    // that outran its wall, not a session the server gave up on, so flattening
    // is truer than borrowing that meaning.
    terminalOutcome: "cancelled",
    ...(params.profileId ? { profile: params.profileId } : {}),
  });
  if (!saved.ok) {
    log("warn", "review_partial_save_failed", {
      reviewId: params.reviewId,
      code: saved.error.code,
    });
    return;
  }
  markCommitted(params.reviewId);
}

interface CreateReviewSessionOptions extends StreamReviewParams {
  activation?: {
    generation: number;
    isAuthorized: () => boolean;
  };
}

export async function createReviewSession(
  aiClient: InitializedAIClient,
  options: CreateReviewSessionOptions,
): Promise<
  Result<
    CreateReviewSessionResult,
    {
      code: ReviewErrorCode | typeof ErrorCode.TRUST_REQUIRED | "SECRETS_MIGRATION_FAILED";
      message: string;
    }
  >
> {
  const {
    mode = "unstaged",
    files,
    lenses: lensIds,
    profile: profileId,
    projectPath: projectPathOption,
    activation,
  } = options;
  const projectPath = projectPathOption ?? process.cwd();
  if (activation && !activation.isAuthorized()) {
    return err({
      code: ErrorCode.TRUST_REQUIRED,
      message: "Repository access was revoked before the review could start.",
    });
  }
  const settings = await getStore().readSettings();
  if (!settings.ok) {
    return settings.error.code === "SECRETS_MIGRATION_FAILED"
      ? err({
          code: settings.error.code,
          message: "Legacy configuration requires manual migration",
        })
      : err({
          code: ReviewErrorCode.GENERATION_FAILED,
          message: "Configuration settings are unavailable",
        });
  }

  const elapsedStart = performance.now();
  const gitService = createGitService({ cwd: projectPath });

  const [headCommitResult, statusHashResult] = await Promise.all([
    gitService.getHeadCommit(),
    gitService.getStatusHash(),
  ]);

  if (!headCommitResult.ok) {
    return err({
      code: ReviewErrorCode.GENERATION_FAILED,
      message: `Failed to inspect repository state: ${headCommitResult.error.message}`,
    });
  }

  const headCommit = headCommitResult.value;
  const statusHashKind = statusHashResult.kind;
  const statusHash = statusHashResult.kind === "unavailable" ? "" : statusHashResult.hash;
  const scopeKey = buildScopeKey({ files, lenses: lensIds, profile: profileId });
  const reviewDefaults = resolveReviewDefaults({ lensIds, profileId, settings: settings.value });
  const admittedPlan = aiClient.authorization?.plan;
  const reviewConfigKey = buildReviewConfigKey({
    lenses: reviewDefaults.activeLenses,
    profile: reviewDefaults.effectiveProfileId,
    minSeverity: reviewDefaults.severityFilter?.minSeverity,
    admittedExecutionFingerprint: admittedPlan?.executionFingerprint,
    configurationId: admittedPlan?.configurationId,
    configurationRevision: admittedPlan?.configurationRevision,
  });
  const reviewId = randomUUID();
  const bufferedEvents: FullReviewStreamEvent[] = [];
  const parsedResult = await resolveGitDiff({
    gitService,
    mode,
    files,
    emit: async (event) => {
      bufferedEvents.push(event);
    },
    reviewId,
  });
  // The model that will read the diff is known here, so the size gate runs here
  // too: a diff past its context window fails now, with the numbers, instead of
  // dying mid-review as an exhausted budget.
  const startResult = planReviewStart(parsedResult, (parsedDiff) =>
    evaluateReviewCapacity({
      parsed: parsedDiff,
      plan: admittedPlan,
      effectiveCallTokenCap: settings.value.effectiveCallTokenCap,
      lensCount: reviewDefaults.activeLenses.length,
    }),
  );
  const sizeWarning = startResult.ok ? startResult.value.capacity.warning : null;
  if (sizeWarning) {
    bufferedEvents.push({ type: "review_size_warning", warning: sizeWarning });
  }

  const parsed = startResult.ok ? startResult.value.parsed : null;
  // The diff is resolved here, so the response can say a clean tree or a git
  // failure ended the run instead of leaving the client to learn it from the
  // replayed stream.
  const outcome: CreateReviewOutcome = resolveCreateOutcome(startResult);
  const reviewInputHash = parsed
    ? buildReviewInputHash({ headCommit, reviewConfigKey, parsed })
    : undefined;
  const statusResult = parsed
    ? await gitService.getStatus().catch((error: unknown) => {
        // The branch this drops becomes the saved review's gitContext.branch, so
        // a failed read must not be indistinguishable from a detached HEAD.
        log("warn", "review_git_status_unavailable", { reviewId, error });
        return null;
      })
    : null;
  const branch = statusResult?.ok ? statusResult.value.branch : null;

  const activate = (): Result<CreateReviewSessionResult, never> => {
    if (parsed && reviewInputHash) {
      const existingSession = getActiveSessionForProject(projectPath, {
        headCommit,
        statusHash,
        statusHashKind,
        mode,
        scopeKey,
        reviewConfigKey,
        reviewInputHash,
      });
      if (existingSession) {
        return ok({
          reviewId: existingSession.reviewId,
          session: existingSession,
          outcome,
        });
      }
    }

    cancelStaleSessionsForProjectMode(
      projectPath,
      mode,
      headCommit,
      statusHash,
      statusHashKind,
      reviewConfigKey,
      reviewInputHash,
    );

    // The issues the run has streamed, tracked here rather than replayed from
    // the session buffer: the buffer is capped, so a long review would lose the
    // earliest findings exactly when the partial write matters most.
    const streamedIssues: ReviewIssue[] = [];

    const session = createSession(reviewId, {
      projectPath,
      headCommit,
      statusHash,
      statusHashKind,
      mode,
      scopeKey,
      reviewConfigKey,
      reviewInputHash,
      provider: aiClient.provider,
      configurationId: admittedPlan?.configurationId,
      configurationRevision: admittedPlan?.configurationRevision,
      admittedExecutionFingerprint: admittedPlan?.executionFingerprint,
      leaseId: aiClient.authorization?.lease.leaseId,
      persistPartial: () =>
        persistPartialReview({
          reviewId,
          projectPath,
          mode,
          issues: streamedIssues,
          parsed,
          branch,
          headCommit,
          lenses: reviewDefaults.activeLenses,
          profileId: reviewDefaults.effectiveProfileId,
          elapsedStart,
        }),
    });
    const stepStartedAt = new Map<StepId, number>();
    const record = (event: FullReviewStreamEvent) => {
      if (event.type === "issue_found") streamedIssues.push(event.issue);
      recordReviewEvent(reviewId, event, stepStartedAt);
    };
    const emit: EmitFn = async (event) => {
      if (session.controller.signal.aborted) return;
      record(event);
    };
    for (const event of bufferedEvents) {
      record(event);
    }
    markReady(reviewId);

    const executionContext = aiClient.authorization
      ? createReviewExecutionContext(aiClient.authorization)
      : null;

    if (!startResult.ok) {
      void (async () => {
        try {
          await handleReviewFailure(startResult.error, emit, reviewId, session.controller.signal);
        } finally {
          executionContext?.releaseOnce();
        }
      })();
    } else {
      void runReviewSession({
        aiClient,
        mode,
        projectPath,
        reviewDefaults,
        reviewId,
        signal: session.controller.signal,
        headCommit,
        parsed: startResult.value.parsed,
        capacity: startResult.value.capacity,
        branch,
        elapsedStart,
        emit,
        executionContext,
      }).catch((error) => {
        handleDetachedReviewSessionError(reviewId, error);
        executionContext?.releaseOnce();
      });
    }

    return ok({ reviewId, session, outcome });
  };

  if (!activation) return activate();

  const activated = activateSessionForProject(
    projectPath,
    activation.generation,
    activation.isAuthorized,
    activate,
  );
  if (activated) return activated;

  return err({
    code: ErrorCode.TRUST_REQUIRED,
    message: "Repository access was revoked before the review could start.",
  });
}

interface RunReviewSessionOptions {
  aiClient: AIClient;
  mode: ReviewMode;
  projectPath: string;
  reviewDefaults: ReturnType<typeof resolveReviewDefaults>;
  reviewId: string;
  signal: AbortSignal;
  headCommit: string;
  parsed: ParsedDiff;
  capacity: ReviewCapacityPlan;
  branch: string | null;
  elapsedStart: number;
  emit: EmitFn;
  executionContext: ReviewExecutionContext | null;
}

async function runReviewSession({
  aiClient,
  mode,
  projectPath,
  reviewDefaults,
  reviewId,
  signal,
  headCommit,
  parsed,
  capacity,
  branch,
  elapsedStart,
  emit,
  executionContext,
}: RunReviewSessionOptions): Promise<void> {
  try {
    signal.throwIfAborted();

    const config = await resolveReviewConfig({
      defaults: reviewDefaults,
      projectPath,
      focusPaths: parsed.files.map((file) => file.filePath),
      emit,
      signal,
    });
    signal.throwIfAborted();

    const outcomeResult = await executeReview({
      aiClient,
      parsed,
      capacity,
      config,
      emit,
      signal,
      ...(executionContext ? { executionContext } : {}),
    });
    if (!outcomeResult.ok) {
      await handleReviewFailure(outcomeResult.error, emit, reviewId, signal);
      return;
    }
    const outcome = outcomeResult.value;
    if (executionContext) {
      await recordConformanceEvidence(executionContext, outcome, reviewId);
    }
    const durationMs = Math.round(performance.now() - elapsedStart);

    const finalized = await finalizeReview({
      outcome,
      emit,
      reviewId,
      projectPath,
      mode,
      parsed,
      profileId: config.effectiveProfileId,
      activeLenses: config.activeLenses,
      durationMs,
      signal,
      branch,
      headCommit,
    });
    if (!finalized.ok) {
      await handleReviewFailure(finalized.error, emit, reviewId, signal);
      return;
    }
  } catch (error) {
    await handleReviewFailure(error, emit, reviewId, signal);
  } finally {
    executionContext?.releaseOnce();
  }
}
