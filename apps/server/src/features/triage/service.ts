import { randomUUID } from "node:crypto";
import { createGitService } from "../../shared/lib/services/git.js";
import type { AIClient } from "../../shared/lib/ai/index.js";
import { getErrorMessage } from "../../shared/lib/errors.js";
import { parseDiff, filterDiffByFiles } from "../../shared/lib/diff/index.js";
import { triageReviewStream, getProfile } from "../../shared/lib/review/index.js";
import { saveTriageReview } from "../../shared/lib/storage/index.js";
import { enrichIssues } from "../../shared/lib/services/enrich.js";
import { generateReport } from "../../shared/lib/services/report.js";
import type { LensId, ProfileId } from "@repo/schemas/lens";
import { ErrorCode } from "@repo/schemas/errors";
import type { SSEWriter } from "../../shared/lib/ai-client.js";
import { writeSSEError } from "../../shared/lib/sse-helpers.js";
import { createGitDiffError } from "../../shared/lib/git-diff-error.js";
import type { StepEvent, StepId, ReviewStartedEvent } from "@repo/schemas/step-event";
import type { EnrichProgressEvent } from "@repo/schemas/enrich-event";
import type { FullTriageStreamEvent } from "@repo/schemas";
import type { ReviewMode } from "@repo/schemas/triage-storage";
import {
  createSession,
  addEvent,
  markComplete,
  markReady,
  getActiveSessionForProject,
  subscribe,
} from "../../shared/lib/storage/active-sessions.js";

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

async function writeStreamEvent(stream: SSEWriter, event: FullTriageStreamEvent): Promise<void> {
  await stream.writeSSE({
    event: event.type,
    data: JSON.stringify(event),
  });
}

// Server-specific triage options extending schema options
export interface TriageOptions {
  mode?: ReviewMode;
  files?: string[];
  lenses?: LensId[];
  profile?: ProfileId;
  projectPath?: string;
}

export async function streamTriageToSSE(
  aiClient: AIClient,
  options: TriageOptions,
  stream: SSEWriter
): Promise<void> {
  const { mode = "unstaged", files, lenses: lensIds, profile: profileId, projectPath: projectPathOption } = options;
  const startTime = Date.now();
  const projectPath = projectPathOption ?? process.cwd();
  const gitService = createGitService({ cwd: projectPath });

  let headCommit: string;
  let statusHash: string;
  try {
    headCommit = await gitService.getHeadCommit();
    statusHash = await gitService.getStatusHash();
  } catch (error) {
    headCommit = "";
    statusHash = "";
  }

  const existingSession = headCommit ? getActiveSessionForProject(projectPath, headCommit, statusHash, mode) : undefined;

  if (existingSession) {
    for (const event of existingSession.events) {
      await writeStreamEvent(stream, event);
    }
    if (existingSession.isComplete) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const unsubscribe = subscribe(existingSession.reviewId, async (event) => {
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

  const reviewId = randomUUID();
  createSession(reviewId, projectPath, headCommit, statusHash, mode);

  const emitEvent = async (event: FullTriageStreamEvent): Promise<void> => {
    addEvent(reviewId, event);
    await writeStreamEvent(stream, event);
  };

  const completeWithError = async (
    message: string,
    code: string,
    step?: StepId
  ): Promise<void> => {
    if (step) {
      await emitEvent(stepError(step, message));
    }
    await writeSSEError(stream, message, code);
    markComplete(reviewId);
  };

  try {
    await emitEvent({
      type: "review_started",
      reviewId,
      filesTotal: 0,
      timestamp: now(),
    } satisfies ReviewStartedEvent);

    await emitEvent(stepStart("diff"));

    // Mark session ready AFTER initial events are emitted
    // This prevents reconnecting clients from seeing an empty session
    markReady(reviewId);

    let diff: string;
    try {
      diff = await gitService.getDiff(mode);
    } catch (error: unknown) {
      await completeWithError(createGitDiffError(error).message, ErrorCode.GIT_NOT_FOUND, "diff");
      return;
    }

    if (!diff.trim()) {
      const errorMessage = mode === "staged"
        ? "No staged changes found. Use 'git add' to stage files, or review unstaged changes instead."
        : "No unstaged changes found. Make some edits first, or review staged changes instead.";
      await completeWithError(errorMessage, "NO_DIFF", "diff");
      return;
    }

    let parsed = parseDiff(diff);

    await emitEvent(stepComplete("diff"));

    await emitEvent({
      type: "review_started",
      reviewId,
      filesTotal: parsed.files.length,
      timestamp: now(),
    } satisfies ReviewStartedEvent);

    if (files && files.length > 0) {
      parsed = filterDiffByFiles(parsed, files);
      if (parsed.files.length === 0) {
        await completeWithError(`None of the specified files have ${mode} changes`, "NO_DIFF");
        return;
      }
    }

    if (parsed.totalStats.totalSizeBytes > MAX_DIFF_SIZE_BYTES) {
      const sizeMB = (parsed.totalStats.totalSizeBytes / 1024 / 1024).toFixed(2);
      const maxMB = (MAX_DIFF_SIZE_BYTES / 1024 / 1024).toFixed(2);
      await completeWithError(
        `Diff too large (${sizeMB}MB exceeds ${maxMB}MB limit). Try reviewing fewer files or use file filtering.`,
        ErrorCode.VALIDATION_ERROR
      );
      return;
    }

    const profile = profileId ? getProfile(profileId) : undefined;
    const activeLenses = lensIds ?? profile?.lenses ?? ["correctness"];

    await emitEvent(stepStart("triage"));

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
      await completeWithError(result.error.message, "AI_ERROR", "triage");
      return;
    }

    await emitEvent(stepComplete("triage"));

    await emitEvent(stepStart("enrich"));

    const enrichedIssues = await enrichIssues(
      result.value.issues,
      gitService,
      async (event: EnrichProgressEvent) => {
        await emitEvent(event);
      }
    );

    await emitEvent(stepComplete("enrich"));

    await emitEvent(stepStart("report"));

    // Note: lens-specific stats are tracked during triage via orchestrator_complete event
    // The generateReport function handles deduplication, sorting, and summary generation
    const finalResult = generateReport(enrichedIssues, []);

    await emitEvent(stepComplete("report"));

    const status = await gitService.getStatus().catch(() => null);

    const saveResult = await saveTriageReview({
      reviewId,
      projectPath,
      mode,
      result: finalResult,
      diff: parsed,
      branch: status?.branch ?? null,
      commit: null,
      profile: profileId,
      lenses: activeLenses as LensId[],
      durationMs: Date.now() - startTime,
    });

    if (!saveResult.ok) {
      await completeWithError(saveResult.error.message, ErrorCode.INTERNAL_ERROR);
      return;
    }

    await emitEvent({
      type: "complete",
      result: finalResult,
      reviewId,
      durationMs: Date.now() - startTime,
    });
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
