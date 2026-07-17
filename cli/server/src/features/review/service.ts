import { createHash, randomUUID } from "node:crypto";
import type { Result } from "@diffgazer/core/result";
import { err, ok } from "@diffgazer/core/result";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { FullReviewStreamEvent, StepId } from "@diffgazer/core/schemas/events";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import type { InitializedAIClient } from "../../shared/lib/ai/client.js";
import type { AIClient } from "../../shared/lib/ai/types.js";
import { createGitService } from "../../shared/lib/git/service.js";
import { log } from "../../shared/lib/log.js";
import { activateSessionForProject } from "../../shared/lib/session-registry.js";
import { isReviewAbort } from "./abort.js";
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
import type { EmitFn, StreamReviewParams } from "./types.js";

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
    if (error.step) {
      await emit(stepError(error.step, error.message));
    }
    await emit(reviewStreamError(error.message, error.code));
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

export interface CreateReviewSessionResult {
  reviewId: string;
  session: ActiveSession;
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
    { code: ReviewErrorCode | typeof ErrorCode.TRUST_REQUIRED; message: string }
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
  const reviewDefaults = resolveReviewDefaults({ lensIds, profileId });
  const reviewConfigKey = buildReviewConfigKey({
    lenses: reviewDefaults.activeLenses,
    profile: reviewDefaults.effectiveProfileId,
    minSeverity: reviewDefaults.severityFilter?.minSeverity,
    executionFingerprint: aiClient.executionFingerprint,
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
  const parsed = parsedResult.ok ? parsedResult.value : null;
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
        return ok({ reviewId: existingSession.reviewId, session: existingSession });
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

    if (!parsedResult.ok) {
      void handleReviewFailure(parsedResult.error, emit, reviewId, session.controller.signal);
    } else {
      void runReviewSession(
        aiClient,
        { mode, projectPath },
        reviewDefaults,
        reviewId,
        session.controller.signal,
        headCommit,
        parsedResult.value,
        branch,
        elapsedStart,
        emit,
      ).catch((error) => {
        handleDetachedReviewSessionError(reviewId, error);
      });
    }

    return ok({ reviewId, session });
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

async function runReviewSession(
  aiClient: AIClient,
  options: StreamReviewParams,
  reviewDefaults: ReturnType<typeof resolveReviewDefaults>,
  reviewId: string,
  signal: AbortSignal,
  headCommit: string,
  parsed: ParsedDiff,
  branch: string | null,
  elapsedStart: number,
  emit: EmitFn,
): Promise<void> {
  const { mode = "unstaged", projectPath: projectPathOption } = options;
  const projectPath = projectPathOption ?? process.cwd();

  try {
    signal.throwIfAborted();

    const config = await resolveReviewConfig({
      defaults: reviewDefaults,
      projectPath,
      emit,
      signal,
    });
    signal.throwIfAborted();

    const outcomeResult = await executeReview({ aiClient, parsed, config, emit, signal });
    if (!outcomeResult.ok) {
      await handleReviewFailure(outcomeResult.error, emit, reviewId, signal);
      return;
    }
    const outcome = outcomeResult.value;

    const durationMs = Math.round(performance.now() - elapsedStart);

    const finalResultResult = await finalizeReview({
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
    if (!finalResultResult.ok) {
      await handleReviewFailure(finalResultResult.error, emit, reviewId, signal);
      return;
    }
  } catch (error) {
    await handleReviewFailure(error, emit, reviewId, signal);
  }
}
