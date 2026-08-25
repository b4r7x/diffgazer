import { createHash, randomUUID } from "node:crypto";
import type { Result } from "@diffgazer/core/result";
import { err, ok } from "@diffgazer/core/result";
import { ConfigurationIdSchema } from "@diffgazer/core/schemas/config";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { FullReviewStreamEvent, StepId } from "@diffgazer/core/schemas/events";
import {
  type CreateReviewOutcome,
  ReviewErrorCode,
  type ReviewMode,
  type TerminalOutcome,
} from "@diffgazer/core/schemas/review";
import type { InitializedAIClient } from "../../shared/lib/ai/client/initialize.js";
import type { AIClient } from "../../shared/lib/ai/types.js";
import { createAdmissionEvidence } from "../../shared/lib/config/admission-evidence.js";
import { getStore } from "../../shared/lib/config/store.js";
import { createGitService } from "../../shared/lib/git/service.js";
import { log } from "../../shared/lib/log.js";
import { activateSessionForProject } from "../../shared/lib/session-registry.js";
import { isReviewAbort, type ReviewAbort } from "./abort.js";
import { evaluateReviewCapacity } from "./capacity.js";
import { resolveGitDiff } from "./diff.js";
import type { ParsedDiff } from "./engine/diff/types.js";
import {
  executeReview,
  finalizeReview,
  resolveReviewConfig,
  resolveReviewDefaults,
} from "./pipeline.js";
import { isAbortError, normalizeReviewStreamError, reviewStreamError } from "./stream/events.js";
import { stepError } from "./stream/steps.js";
import {
  type ActiveSession,
  addEvent,
  buildReviewConfigKey,
  buildScopeKey,
  cancelStaleSessionsForProjectMode,
  createSession,
  getActiveSessionForProject,
  getSession,
  markComplete,
  markReady,
} from "./stream/store.js";
import type { EmitFn, ReviewExecutionContext, ReviewOutcome, StreamReviewParams } from "./types.js";
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
    const normalized = normalizeReviewStreamError(error);
    if (error.step) {
      await emit(stepError(error.step, normalized.message));
    }
    await emit(reviewStreamError(normalized.message, normalized.code));
    markComplete(reviewId);
    return;
  }

  const normalized = normalizeReviewStreamError(error);
  await emit(reviewStreamError(normalized.message, normalized.code));
  markComplete(reviewId);
}

function handleDetachedReviewSessionError(reviewId: string, error: unknown): void {
  const session = getSession(reviewId);
  if (!session || session.isComplete) {
    return;
  }

  const normalized = normalizeReviewStreamError(error);
  addEvent(reviewId, reviewStreamError(normalized.message, normalized.code));
  markComplete(reviewId);
}

function resolveCreateOutcome(parsed: Result<ParsedDiff, ReviewAbort>): CreateReviewOutcome {
  if (parsed.ok) return "running";
  return parsed.error.code === ReviewErrorCode.NO_DIFF ? "no-diff" : "failed";
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
  const capacityResult = parsedResult.ok
    ? evaluateReviewCapacity({ parsed: parsedResult.value, plan: admittedPlan })
    : null;
  const startResult: Result<ParsedDiff, ReviewAbort> =
    capacityResult && !capacityResult.ok ? err(capacityResult.error) : parsedResult;
  const sizeWarning = capacityResult?.ok ? capacityResult.value : null;
  if (sizeWarning) {
    bufferedEvents.push({ type: "review_size_warning", warning: sizeWarning });
  }

  const parsed = startResult.ok ? startResult.value : null;
  // The diff is resolved here, so the response can say a clean tree or a git
  // failure ended the run instead of leaving the client to learn it from the
  // replayed stream.
  const outcome: CreateReviewOutcome = resolveCreateOutcome(startResult);
  const reviewInputHash = parsed
    ? buildReviewInputHash({ headCommit, reviewConfigKey, parsed })
    : undefined;
  const statusResult = parsed ? await gitService.getStatus().catch(() => null) : null;
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
    });
    const stepStartedAt = new Map<StepId, number>();
    const emit: EmitFn = async (event) => {
      if (session.controller.signal.aborted) return;
      recordReviewEvent(reviewId, event, stepStartedAt);
    };
    for (const event of bufferedEvents) {
      recordReviewEvent(reviewId, event, stepStartedAt);
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
        parsed: startResult.value,
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

function conformanceEvidenceStatus(
  receiptOutcome: TerminalOutcome | undefined,
  evidenceState: "proven" | "unproven",
): "failed" | "passed" | null {
  if (receiptOutcome === "schema-failed") return "failed";
  if (receiptOutcome === "completed" && evidenceState === "unproven") return "passed";
  return null;
}

/**
 * The review is the conformance check. A schema failure caches the fast-fail
 * for this exact tuple; a completed review records the proof an unproven
 * admission went without. Recording is best effort: a tuple edited mid-review
 * loses the cache entry, never the review the user is watching.
 */
async function recordConformanceEvidence(
  executionContext: ReviewExecutionContext,
  outcome: ReviewOutcome,
  reviewId: string,
): Promise<void> {
  const { authorization } = executionContext;
  const status = conformanceEvidenceStatus(
    outcome.execution?.receipt.outcome,
    authorization.evidenceState,
  );
  if (!status) return;

  const { plan } = authorization;
  const recorded = await getStore().recordConfigurationEvidence(
    ConfigurationIdSchema.parse(plan.configurationId),
    createAdmissionEvidence({
      evidenceKey: plan.evidenceKey,
      checkedAt: new Date().toISOString(),
      status,
      expiresAt: null,
    }),
  );
  if (!recorded.ok) {
    log("warn", "review_conformance_evidence_unrecorded", {
      reviewId,
      configurationId: plan.configurationId,
      status,
      code: recorded.error.code,
    });
  }
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
