import { randomUUID } from "node:crypto";
import { createGitService } from "../../shared/lib/git/service.js";
import { createGitDiffError } from "../../shared/lib/git/errors.js";
import type { AIClient } from "../../shared/lib/ai/types.js";
import { getErrorMessage } from "@stargazer/core";
import { parseDiff } from "../../shared/lib/diff/parser.js";
import type { ParsedDiff } from "../../shared/lib/diff/types.js";
import { saveReview } from "../../shared/lib/storage/reviews.js";
import type { LensId, ProfileId } from "@stargazer/schemas/lens";
import { ErrorCode } from "@stargazer/schemas/errors";
import type {
  ReviewIssue,
  ReviewResult,
  ReviewSeverity,
} from "@stargazer/schemas/review";
import { writeSSEError, type SSEWriter } from "../../shared/lib/http/sse.js";
import type { StepEvent, StepId, ReviewStartedEvent } from "@stargazer/schemas/step-event";
import type { EnrichProgressEvent } from "@stargazer/schemas/enrich-event";
import type { FullReviewStreamEvent } from "@stargazer/schemas";
import type { ReviewMode } from "@stargazer/schemas/review-storage";
import { getSettings } from "../../shared/lib/config/store.js";
import { getProfile } from "../../shared/lib/review/profiles.js";
import { now } from "../../shared/lib/review/utils.js";
import { severityRank } from "@stargazer/core";
import { orchestrateReview } from "../../shared/lib/review/orchestrate.js";
import {
  createSession,
  markReady,
  addEvent,
  markComplete,
  subscribe,
  getActiveSessionForProject,
  getSession,
  deleteSession,
  type ActiveSession,
} from "./sessions.js";
import { buildProjectContextSnapshot } from "./context.js";
import { enrichIssues } from "./enrichment.js";

// ============= Constants =============

const MAX_DIFF_SIZE_BYTES = 524288; // 512KB
const MAX_AGENT_CONCURRENCY = 1;

// ============= SSE Helpers =============

function stepStart(step: StepId): StepEvent {
  return { type: "step_start", step, timestamp: now() };
}

function stepComplete(step: StepId): StepEvent {
  return { type: "step_complete", step, timestamp: now() };
}

function stepError(step: StepId, error: string): StepEvent {
  return { type: "step_error", step, error, timestamp: now() };
}

async function writeStreamEvent(stream: SSEWriter, event: FullReviewStreamEvent): Promise<void> {
  await stream.writeSSE({
    event: event.type,
    data: JSON.stringify(event),
  });
}

// ============= Report Generation =============

function generateExecutiveSummary(issues: ReviewIssue[], orchestrationSummary: string): string {
  const severityCounts = issues.reduce((acc, issue) => {
    acc[issue.severity] = (acc[issue.severity] ?? 0) + 1;
    return acc;
  }, {} as Record<ReviewSeverity, number>);

  const uniqueFiles = new Set(issues.map(i => i.file)).size;

  const severityLines = Object.entries(severityCounts)
    .sort(([a], [b]) => severityRank(a as ReviewSeverity) - severityRank(b as ReviewSeverity))
    .map(([severity, count]) => `- ${severity}: ${count}`)
    .join("\n");

  const summaryParts = [
    `Found ${issues.length} issue${issues.length !== 1 ? "s" : ""} across ${uniqueFiles} file${uniqueFiles !== 1 ? "s" : ""}.`,
    "",
    "Severity breakdown:",
    severityLines,
  ];

  if (orchestrationSummary) {
    summaryParts.push("", orchestrationSummary);
  }

  return summaryParts.join("\n");
}

function generateReport(issues: ReviewIssue[], orchestrationSummary: string): ReviewResult {
  const summary = generateExecutiveSummary(issues, orchestrationSummary);
  return { summary, issues };
}

// ============= Diff Helpers =============

function filterDiffByFiles(parsed: ParsedDiff, files: string[]): ParsedDiff {
  if (files.length === 0) {
    return parsed;
  }

  const normalizedFiles = new Set(files.map((f) => f.replace(/^\.\//, "")));

  const filteredFiles = parsed.files.filter((file) => {
    const normalizedPath = file.filePath.replace(/^\.\//, "");
    return normalizedFiles.has(normalizedPath);
  });

  const totalStats = filteredFiles.reduce(
    (acc, file) => ({
      filesChanged: acc.filesChanged + 1,
      additions: acc.additions + file.stats.additions,
      deletions: acc.deletions + file.stats.deletions,
      totalSizeBytes: acc.totalSizeBytes + file.stats.sizeBytes,
    }),
    { filesChanged: 0, additions: 0, deletions: 0, totalSizeBytes: 0 }
  );

  return { files: filteredFiles, totalStats };
}

// ============= Pipeline Steps =============

/**
 * Thrown to short-circuit the review pipeline. Caught by the orchestrator
 * to emit the appropriate SSE error event and mark the session complete.
 */
class ReviewAbort {
  constructor(
    readonly message: string,
    readonly code: string,
    readonly step?: StepId
  ) {}
}

type EmitFn = (event: FullReviewStreamEvent) => Promise<void>;

async function resolveGitDiff(params: {
  gitService: ReturnType<typeof createGitService>;
  mode: ReviewMode;
  files?: string[];
  emit: EmitFn;
  reviewId: string;
}): Promise<ParsedDiff> {
  const { gitService, mode, files, emit, reviewId } = params;

  await emit(stepStart("diff"));
  markReady(reviewId);

  let diff: string;
  try {
    diff = await gitService.getDiff(mode);
  } catch (error: unknown) {
    throw new ReviewAbort(createGitDiffError(error).message, ErrorCode.GIT_NOT_FOUND, "diff");
  }

  if (!diff.trim()) {
    const errorMessage = mode === "staged"
      ? "No staged changes found. Use 'git add' to stage files, or review unstaged changes instead."
      : "No unstaged changes found. Make some edits first, or review staged changes instead.";
    throw new ReviewAbort(errorMessage, "NO_DIFF", "diff");
  }

  let parsed = parseDiff(diff);

  await emit(stepComplete("diff"));

  await emit({
    type: "review_started",
    reviewId,
    filesTotal: parsed.files.length,
    timestamp: now(),
  } satisfies ReviewStartedEvent);

  if (files && files.length > 0) {
    parsed = filterDiffByFiles(parsed, files);
    if (parsed.files.length === 0) {
      throw new ReviewAbort(`None of the specified files have ${mode} changes`, "NO_DIFF");
    }
  }

  if (parsed.totalStats.totalSizeBytes > MAX_DIFF_SIZE_BYTES) {
    const sizeMB = (parsed.totalStats.totalSizeBytes / 1024 / 1024).toFixed(2);
    const maxMB = (MAX_DIFF_SIZE_BYTES / 1024 / 1024).toFixed(2);
    throw new ReviewAbort(
      `Diff too large (${sizeMB}MB exceeds ${maxMB}MB limit). Try reviewing fewer files or use file filtering.`,
      ErrorCode.VALIDATION_ERROR
    );
  }

  return parsed;
}

interface ResolvedConfig {
  activeLenses: LensId[];
  profile: ReturnType<typeof getProfile> | undefined;
  projectContext: string;
}

async function resolveReviewConfig(params: {
  lensIds?: LensId[];
  profileId?: ProfileId;
  projectPath: string;
  emit: EmitFn;
}): Promise<ResolvedConfig> {
  const { lensIds, profileId, projectPath, emit } = params;

  const profile = profileId ? getProfile(profileId) : undefined;
  const settings = getSettings();
  const activeLenses = lensIds ?? profile?.lenses ?? settings.defaultLenses ?? ["correctness"];

  await emit(stepStart("context"));
  let projectContext = "";
  try {
    const contextSnapshot = await buildProjectContextSnapshot(projectPath);
    projectContext = contextSnapshot.markdown;
  } catch {
    projectContext = "";
  }
  await emit(stepComplete("context"));

  return { activeLenses: activeLenses as LensId[], profile, projectContext };
}

interface ReviewOutcome {
  issues: ReviewIssue[];
  summary: string;
}

async function executeReview(params: {
  aiClient: AIClient;
  parsed: ParsedDiff;
  config: ResolvedConfig;
  emit: EmitFn;
}): Promise<ReviewOutcome> {
  const { aiClient, parsed, config, emit } = params;

  await emit(stepStart("review"));

  const result = await orchestrateReview(
    aiClient,
    parsed,
    {
      lenses: config.activeLenses,
      filter: config.profile?.filter,
    },
    async (event) => {
      await emit(event);
    },
    {
      concurrency: MAX_AGENT_CONCURRENCY,
      projectContext: config.projectContext,
      partialOnAllFailed: true,
    },
  );

  if (!result.ok) {
    throw new ReviewAbort(result.error.message, "AI_ERROR", "review");
  }

  await emit(stepComplete("review"));

  return { issues: result.value.issues, summary: result.value.summary };
}

async function finalizeReview(params: {
  outcome: ReviewOutcome;
  gitService: ReturnType<typeof createGitService>;
  emit: EmitFn;
  reviewId: string;
  projectPath: string;
  mode: ReviewMode;
  parsed: ParsedDiff;
  profileId?: ProfileId;
  activeLenses: LensId[];
  startTime: number;
}): Promise<ReviewResult> {
  const { outcome, gitService, emit, reviewId, projectPath, mode, parsed, profileId, activeLenses, startTime } = params;

  await emit(stepStart("enrich"));

  const enrichedIssues = await enrichIssues(
    outcome.issues,
    gitService,
    async (event: EnrichProgressEvent) => {
      await emit(event);
    }
  );

  await emit(stepComplete("enrich"));

  await emit(stepStart("report"));

  const finalResult = generateReport(enrichedIssues, outcome.summary);

  await emit(stepComplete("report"));

  const status = await gitService.getStatus().catch(() => null);

  const saveResult = await saveReview({
    reviewId,
    projectPath,
    mode,
    result: finalResult,
    diff: parsed,
    branch: status?.branch ?? null,
    commit: null,
    profile: profileId,
    lenses: activeLenses,
    durationMs: Date.now() - startTime,
  });

  if (!saveResult.ok) {
    throw new ReviewAbort(saveResult.error.message, ErrorCode.INTERNAL_ERROR);
  }

  return finalResult;
}

// ============= Session Replay =============

async function tryReplayExistingSession(
  stream: SSEWriter,
  projectPath: string,
  headCommit: string,
  statusHash: string,
  mode: ReviewMode
): Promise<boolean> {
  if (!headCommit) return false;

  const existingSession = getActiveSessionForProject(projectPath, headCommit, statusHash, mode);
  if (!existingSession) return false;

  for (const event of existingSession.events) {
    await writeStreamEvent(stream, event);
  }
  if (existingSession.isComplete) {
    return true;
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
    if (existingSession.isComplete) {
      unsubscribe();
      resolve();
    }
  });

  return true;
}

// ============= Main Orchestrator =============

export interface StreamReviewParams {
  mode?: ReviewMode;
  files?: string[];
  lenses?: LensId[];
  profile?: ProfileId;
  projectPath?: string;
}

export async function streamReviewToSSE(
  aiClient: AIClient,
  options: StreamReviewParams,
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
  } catch {
    headCommit = "";
    statusHash = "";
  }

  const replayed = await tryReplayExistingSession(stream, projectPath, headCommit, statusHash, mode);
  if (replayed) return;

  const reviewId = randomUUID();
  createSession(reviewId, projectPath, headCommit, statusHash, mode);

  const emit: EmitFn = async (event) => {
    addEvent(reviewId, event);
    await writeStreamEvent(stream, event);
  };

  try {
    const parsed = await resolveGitDiff({ gitService, mode, files, emit, reviewId });

    const config = await resolveReviewConfig({ lensIds, profileId, projectPath, emit });

    const outcome = await executeReview({ aiClient, parsed, config, emit });

    const finalResult = await finalizeReview({
      outcome, gitService, emit, reviewId, projectPath, mode,
      parsed, profileId, activeLenses: config.activeLenses, startTime,
    });

    await emit({
      type: "complete",
      result: finalResult,
      reviewId,
      durationMs: Date.now() - startTime,
    });
    markComplete(reviewId);
  } catch (error) {
    if (error instanceof ReviewAbort) {
      if (error.step) {
        await emit(stepError(error.step, error.message));
      }
      await writeSSEError(stream, error.message, error.code);
      markComplete(reviewId);
      return;
    }
    markComplete(reviewId);
    deleteSession(reviewId);
    try {
      await writeSSEError(stream, getErrorMessage(error), ErrorCode.INTERNAL_ERROR);
    } catch {
      throw error;
    }
  }
}
