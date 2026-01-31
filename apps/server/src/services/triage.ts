import { randomUUID } from "node:crypto";
import { createGitService } from "./git.js";
import type { AIClient } from "../ai/index.js";
import { getErrorMessage } from "@repo/core";
import { logger } from "../lib/logger.js";
import { parseDiff, filterDiffByFiles } from "../diff/index.js";
import { triageReviewStream, getProfile } from "../review/index.js";
import { saveTriageReview } from "../storage/index.js";
import { enrichIssues } from "./enrich.js";
import { generateReport } from "./report.js";
import type { TriageResult } from "@repo/schemas/triage";
import type { LensId, ProfileId } from "@repo/schemas/lens";
import { ErrorCode } from "@repo/schemas/errors";
import type { SSEWriter } from "../lib/ai-client.js";
import { writeSSEError } from "../lib/sse-helpers.js";
import { createGitDiffError } from "./review.js";
import type { StepEvent, StepId, ReviewStartedEvent } from "@repo/schemas/step-event";
import type { EnrichProgressEvent } from "@repo/schemas/enrich-event";
import type { FullTriageStreamEvent } from "@repo/schemas";
import { createSession, addEvent, markComplete, markReady, getActiveSessionForProject, subscribe } from "../storage/active-sessions.js";

const MAX_DIFF_SIZE_BYTES = 524288; // 512KB

function now(): string {
  return new Date().toISOString();
}

function stepStart(step: StepId): StepEvent {
  return { type: "step_start", step, timestamp: now() };
}

function stepComplete(step: StepId): StepEvent {
  return { type: "step_complete", step, timestamp: now() };
}

function stepError(step: StepId, error: string): StepEvent {
  return { type: "step_error", step, error, timestamp: now() };
}

const gitService = createGitService();

async function writeStreamEvent(stream: SSEWriter, event: FullTriageStreamEvent): Promise<void> {
  await stream.writeSSE({
    event: event.type,
    data: JSON.stringify(event),
  });
}

async function writeTriageComplete(stream: SSEWriter, result: TriageResult, reviewId: string, durationMs: number): Promise<void> {
  await stream.writeSSE({
    event: "complete",
    data: JSON.stringify({ type: "complete", result, reviewId, durationMs }),
  });
}

// Server-specific triage options extending schema options
export interface TriageOptions {
  staged?: boolean;
  files?: string[];
  lenses?: LensId[];
  profile?: ProfileId;
}

export async function streamTriageToSSE(
  aiClient: AIClient,
  options: TriageOptions,
  stream: SSEWriter
): Promise<void> {
  const { staged = true, files, lenses: lensIds, profile: profileId } = options;
  const startTime = Date.now();
  const projectPath = process.cwd();

  logger.info(`Starting triage stream: staged=${staged}, files=${files?.length ?? 0}, lenses=${lensIds?.join(",") ?? "default"}`);

  // Check for existing active session for this project
  const existingSession = getActiveSessionForProject(projectPath);
  if (existingSession) {
    logger.info(`Replaying existing session: reviewId=${existingSession.reviewId}, events=${existingSession.events.length}`);
    // Replay events
    for (const event of existingSession.events) {
      await writeStreamEvent(stream, event);
    }
    if (existingSession.isComplete) {
      return;
    }
    // Subscribe and forward new events until session completes
    const sessionReviewId = existingSession.reviewId;
    await new Promise<void>((resolve, reject) => {
      const unsubscribe = subscribe(sessionReviewId, async (event) => {
        try {
          await writeStreamEvent(stream, event);
          if (event.type === "complete" || event.type === "error") {
            unsubscribe();
            resolve();
          }
        } catch (e) {
          unsubscribe();
          reject(e);
        }
      });
      // Re-check after subscribing to handle race condition
      if (existingSession.isComplete) {
        unsubscribe();
        resolve();
      }
    });
    return;
  }

  // Generate reviewId early so client can track this review immediately
  const reviewId = randomUUID();
  createSession(reviewId, projectPath);

  // Helper to emit events to both stream and session store
  const emitEvent = async (event: FullTriageStreamEvent) => {
    console.log('[SERVER:EMIT]', event.type, event.type === 'review_started' ? event.reviewId : '');
    addEvent(reviewId, event);
    await writeStreamEvent(stream, event);
  };

  try {
    // Emit review_started immediately with placeholder filesTotal
    console.log('[SERVER:EMITTING] review_started', reviewId);
    await emitEvent({
      type: "review_started",
      reviewId,
      filesTotal: 0,
      timestamp: now(),
    } satisfies ReviewStartedEvent);
    console.log('[SERVER:EMITTED] review_started');

    // Step: diff
    console.log('[SERVER:EMITTING] step_start diff');
    await emitEvent(stepStart("diff"));
    console.log('[SERVER:EMITTED] step_start diff');

    // Mark session ready AFTER initial events are emitted
    // This prevents reconnecting clients from seeing an empty session
    markReady(reviewId);

    let diff: string;
    try {
      logger.debug(`Fetching git diff: staged=${staged}`);
      diff = await gitService.getDiff(staged);
    } catch (error: unknown) {
      const errorMessage = createGitDiffError(error).message;
      logger.error(`Git diff failed: ${errorMessage}`);
      await emitEvent(stepError("diff", errorMessage));
      await writeSSEError(stream, errorMessage, ErrorCode.GIT_NOT_FOUND);
      markComplete(reviewId);
      return;
    }

    if (!diff.trim()) {
      logger.warn(`Empty diff detected: staged=${staged}`);
      const errorMessage = staged
        ? "No staged changes found. Use 'git add' to stage files, or review unstaged changes instead."
        : "No unstaged changes found. Make some edits first, or review staged changes instead.";
      await emitEvent(stepError("diff", errorMessage));
      await writeSSEError(stream, errorMessage, "NO_DIFF");
      markComplete(reviewId);
      return;
    }

    let parsed = parseDiff(diff);

    logger.info(`Diff retrieved: files=${parsed.files.length}, size=${parsed.totalStats.totalSizeBytes}`);

    console.log('[SERVER:EMITTING] step_complete diff');
    await emitEvent(stepComplete("diff"));
    console.log('[SERVER:EMITTED] step_complete diff');

    // Update client with actual file count
    console.log('[SERVER:EMITTING] review_started (update filesTotal)', parsed.files.length);
    await emitEvent({
      type: "review_started",
      reviewId,
      filesTotal: parsed.files.length,
      timestamp: now(),
    } satisfies ReviewStartedEvent);
    console.log('[SERVER:EMITTED] review_started (update filesTotal)');

    if (files && files.length > 0) {
      parsed = filterDiffByFiles(parsed, files);
      if (parsed.files.length === 0) {
        await writeSSEError(
          stream,
          `None of the specified files have ${staged ? "staged" : "unstaged"} changes`,
          "NO_DIFF"
        );
        markComplete(reviewId);
        return;
      }
    }

    if (parsed.totalStats.totalSizeBytes > MAX_DIFF_SIZE_BYTES) {
      logger.error(`Diff too large: size=${parsed.totalStats.totalSizeBytes}, max=${MAX_DIFF_SIZE_BYTES}`);
      const sizeMB = (parsed.totalStats.totalSizeBytes / 1024 / 1024).toFixed(2);
      const maxMB = (MAX_DIFF_SIZE_BYTES / 1024 / 1024).toFixed(2);
      await writeSSEError(
        stream,
        `Diff too large (${sizeMB}MB exceeds ${maxMB}MB limit). Try reviewing fewer files or use file filtering.`,
        ErrorCode.VALIDATION_ERROR
      );
      markComplete(reviewId);
      return;
    }

    const profile = profileId ? getProfile(profileId) : undefined;
    const activeLenses = lensIds ?? profile?.lenses ?? ["correctness"];

    // Step: triage
    console.log('[SERVER:EMITTING] step_start triage');
    await emitEvent(stepStart("triage"));
    console.log('[SERVER:EMITTED] step_start triage');

    logger.debug(`Starting triage analysis: lenses=${activeLenses.join(",")}`);

    const result = await triageReviewStream(
      aiClient,
      parsed,
      {
        lenses: activeLenses as LensId[],
        filter: profile?.filter,
      },
      async (event) => {
        await emitEvent(event);
      }
    );

    if (!result.ok) {
      logger.error(`Triage analysis failed: ${result.error.message}`);
      await emitEvent(stepError("triage", result.error.message));
      await writeSSEError(stream, result.error.message, "AI_ERROR");
      markComplete(reviewId);
      return;
    }

    console.log('[SERVER:EMITTING] step_complete triage');
    await emitEvent(stepComplete("triage"));
    console.log('[SERVER:EMITTED] step_complete triage');

    logger.info(`Triage complete: issues=${result.value.issues.length}`);

    // Step 3: Enrich context
    console.log('[SERVER:EMITTING] step_start enrich');
    await emitEvent(stepStart("enrich"));
    console.log('[SERVER:EMITTED] step_start enrich');

    const enrichedIssues = await enrichIssues(
      result.value.issues,
      gitService,
      async (event: EnrichProgressEvent) => {
        await emitEvent(event);
      }
    );

    console.log('[SERVER:EMITTING] step_complete enrich');
    await emitEvent(stepComplete("enrich"));
    console.log('[SERVER:EMITTED] step_complete enrich');

    // Step 4: Generate report
    console.log('[SERVER:EMITTING] step_start report');
    await emitEvent(stepStart("report"));
    console.log('[SERVER:EMITTED] step_start report');

    // Note: lens-specific stats are tracked during triage via orchestrator_complete event
    // The generateReport function handles deduplication, sorting, and summary generation
    const finalResult = generateReport(enrichedIssues, []);

    console.log('[SERVER:EMITTING] step_complete report');
    await emitEvent(stepComplete("report"));
    console.log('[SERVER:EMITTED] step_complete report');

    const status = await gitService.getStatus().catch(() => null);

    const saveResult = await saveTriageReview({
      reviewId,
      projectPath: process.cwd(),
      staged,
      result: finalResult,
      diff: parsed,
      branch: status?.branch ?? null,
      commit: null,
      profile: profileId,
      lenses: activeLenses as LensId[],
    });

    if (!saveResult.ok) {
      await writeSSEError(stream, saveResult.error.message, ErrorCode.INTERNAL_ERROR);
      markComplete(reviewId);
      return;
    }

    logger.info(`Review saved: reviewId=${reviewId}, durationMs=${Date.now() - startTime}`);

    console.log('[SERVER:EMITTING] complete');
    await emitEvent({
      type: "complete",
      result: finalResult,
      reviewId,
      durationMs: Date.now() - startTime,
    });
    console.log('[SERVER:EMITTED] complete');
    markComplete(reviewId);
  } catch (error) {
    markComplete(reviewId);
    try {
      await writeSSEError(stream, getErrorMessage(error), ErrorCode.INTERNAL_ERROR);
    } catch {
      throw error;
    }
  }
}
