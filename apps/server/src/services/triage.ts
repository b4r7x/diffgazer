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
import type { TriageResult, TriageOptions as SchemaTriageOptions } from "@repo/schemas/triage";
import type { LensId, ProfileId } from "@repo/schemas/lens";
import { ErrorCode } from "@repo/schemas/errors";
import type { SSEWriter } from "../lib/ai-client.js";
import { writeSSEError } from "../lib/sse-helpers.js";
import { createGitDiffError } from "./review.js";
import type { AgentStreamEvent } from "@repo/schemas/agent-event";
import type { StepEvent, StepId, ReviewStartedEvent } from "@repo/schemas/step-event";
import type { EnrichProgressEvent } from "@repo/schemas/enrich-event";

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

async function writeStreamEvent(stream: SSEWriter, event: AgentStreamEvent | StepEvent | EnrichProgressEvent): Promise<void> {
  const data = JSON.stringify(event);
  console.log('[SERVER:EMIT]', event.type, 'size:', data.length, 'preview:', data.slice(0, 150));
  try {
    await stream.writeSSE({
      event: event.type,
      data: data,
    });
    console.log('[SERVER:EMIT_OK]', event.type);
  } catch (error) {
    console.error('[SERVER:EMIT_ERROR]', event.type, error);
    throw error;
  }
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

  logger.info(`Starting triage stream: staged=${staged}, files=${files?.length ?? 0}, lenses=${lensIds?.join(",") ?? "default"}`);

  // Generate reviewId early so client can track this review immediately
  const reviewId = randomUUID();

  try {
    // Emit review_started immediately with placeholder filesTotal
    await writeStreamEvent(stream, {
      type: "review_started",
      reviewId,
      filesTotal: 0,
      timestamp: now(),
    } satisfies ReviewStartedEvent);

    // Step: diff
    await writeStreamEvent(stream, stepStart("diff"));

    let diff: string;
    try {
      logger.debug(`Fetching git diff: staged=${staged}`);
      diff = await gitService.getDiff(staged);
    } catch (error: unknown) {
      const errorMessage = createGitDiffError(error).message;
      logger.error(`Git diff failed: ${errorMessage}`);
      await writeStreamEvent(stream, stepError("diff", errorMessage));
      await writeSSEError(stream, errorMessage, ErrorCode.GIT_NOT_FOUND);
      return;
    }

    if (!diff.trim()) {
      logger.warn(`Empty diff detected: staged=${staged}`);
      const errorMessage = staged
        ? "No staged changes found. Use 'git add' to stage files, or review unstaged changes instead."
        : "No unstaged changes found. Make some edits first, or review staged changes instead.";
      await writeStreamEvent(stream, stepError("diff", errorMessage));
      await writeSSEError(stream, errorMessage, "NO_DIFF");
      return;
    }

    let parsed = parseDiff(diff);

    logger.info(`Diff retrieved: files=${parsed.files.length}, size=${parsed.totalStats.totalSizeBytes}`);

    await writeStreamEvent(stream, stepComplete("diff"));

    // Update client with actual file count
    await writeStreamEvent(stream, {
      type: "review_started",
      reviewId,
      filesTotal: parsed.files.length,
      timestamp: now(),
    } satisfies ReviewStartedEvent);

    if (files && files.length > 0) {
      parsed = filterDiffByFiles(parsed, files);
      if (parsed.files.length === 0) {
        await writeSSEError(
          stream,
          `None of the specified files have ${staged ? "staged" : "unstaged"} changes`,
          "NO_DIFF"
        );
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
      return;
    }

    const profile = profileId ? getProfile(profileId) : undefined;
    const activeLenses = lensIds ?? profile?.lenses ?? ["correctness"];

    // Step: triage
    await writeStreamEvent(stream, stepStart("triage"));

    logger.debug(`Starting triage analysis: lenses=${activeLenses.join(",")}`);

    const result = await triageReviewStream(
      aiClient,
      parsed,
      {
        lenses: activeLenses as LensId[],
        filter: profile?.filter,
      },
      async (event) => {
        await writeStreamEvent(stream, event);
      }
    );

    if (!result.ok) {
      logger.error(`Triage analysis failed: ${result.error.message}`);
      await writeStreamEvent(stream, stepError("triage", result.error.message));
      await writeSSEError(stream, result.error.message, "AI_ERROR");
      return;
    }

    await writeStreamEvent(stream, stepComplete("triage"));

    logger.info(`Triage complete: issues=${result.value.issues.length}`);

    // Step 3: Enrich context
    await writeStreamEvent(stream, stepStart("enrich"));

    const enrichedIssues = await enrichIssues(
      result.value.issues,
      gitService,
      async (event: EnrichProgressEvent) => {
        await writeStreamEvent(stream, event);
      }
    );

    await writeStreamEvent(stream, stepComplete("enrich"));

    // Step 4: Generate report
    await writeStreamEvent(stream, stepStart("report"));

    // Note: lens-specific stats are tracked during triage via orchestrator_complete event
    // The generateReport function handles deduplication, sorting, and summary generation
    const finalResult = generateReport(enrichedIssues, []);

    await writeStreamEvent(stream, stepComplete("report"));

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
      return;
    }

    logger.info(`Review saved: reviewId=${reviewId}, durationMs=${Date.now() - startTime}`);

    await writeTriageComplete(stream, finalResult, reviewId, Date.now() - startTime);
  } catch (error) {
    try {
      await writeSSEError(stream, getErrorMessage(error), ErrorCode.INTERNAL_ERROR);
    } catch {
      throw error;
    }
  }
}
