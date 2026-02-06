import { createGitDiffError } from "../../shared/lib/git/errors.js";
import type { AIClient } from "../../shared/lib/ai/types.js";
import { parseDiff } from "../../shared/lib/diff/parser.js";
import type { ParsedDiff } from "../../shared/lib/diff/types.js";
import { saveReview } from "../../shared/lib/storage/reviews.js";
import {
  type LensId,
  type ProfileId,
  type ReviewMode,
} from "@stargazer/schemas/review";
import { ErrorCode } from "@stargazer/schemas/errors";
import type {
  ReviewIssue,
  ReviewResult,
  ReviewSeverity,
} from "@stargazer/schemas/review";
import type {
  StepId,
  ReviewStartedEvent,
  EnrichProgressEvent,
} from "@stargazer/schemas/events";
import { getSettings } from "../../shared/lib/config/store.js";
import { getProfile } from "../../shared/lib/review/profiles.js";
import { severityRank } from "@stargazer/core/severity";
import { orchestrateReview } from "../../shared/lib/review/orchestrate.js";
import { buildProjectContextSnapshot } from "./context.js";
import { enrichIssues } from "./enrichment.js";
import type { createGitService } from "../../shared/lib/git/service.js";
import { reviewAbort } from "./utils.js";
import {
  type EmitFn,
  type ResolvedConfig,
  type ReviewOutcome,
} from "./types.js";

export const MAX_DIFF_SIZE_BYTES = 524288; // 512KB
export const MAX_AGENT_CONCURRENCY = 1;

export function generateExecutiveSummary(
  issues: ReviewIssue[],
  orchestrationSummary: string,
): string {
  const severityCounts = issues.reduce(
    (acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] ?? 0) + 1;
      return acc;
    },
    {} as Record<ReviewSeverity, number>,
  );

  const uniqueFiles = new Set(issues.map((i) => i.file)).size;

  const severityLines = Object.entries(severityCounts)
    .sort(
      ([a], [b]) =>
        severityRank(a as ReviewSeverity) - severityRank(b as ReviewSeverity),
    )
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

export function generateReport(
  issues: ReviewIssue[],
  orchestrationSummary: string,
): ReviewResult {
  const summary = generateExecutiveSummary(issues, orchestrationSummary);
  return { summary, issues };
}

export function filterDiffByFiles(
  parsed: ParsedDiff,
  files: string[],
): ParsedDiff {
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
    { filesChanged: 0, additions: 0, deletions: 0, totalSizeBytes: 0 },
  );

  return { files: filteredFiles, totalStats };
}

export async function resolveGitDiff(params: {
  gitService: ReturnType<typeof createGitService>;
  mode: ReviewMode;
  files?: string[];
  emit: EmitFn;
  reviewId: string;
}): Promise<ParsedDiff> {
  const { gitService, mode, files, emit, reviewId } = params;

  await emit(stepStart("diff"));

  let diff: string;
  try {
    diff = await gitService.getDiff(mode);
  } catch (error: unknown) {
    throw reviewAbort(
      createGitDiffError(error).message,
      ErrorCode.GIT_NOT_FOUND,
      "diff",
    );
  }

  if (!diff.trim()) {
    const errorMessage =
      mode === "staged"
        ? "No staged changes found. Use 'git add' to stage files, or review unstaged changes instead."
        : "No unstaged changes found. Make some edits first, or review staged changes instead.";
    throw reviewAbort(errorMessage, "NO_DIFF", "diff");
  }

  let parsed = parseDiff(diff);

  await emit(stepComplete("diff"));

  await emit({
    type: "review_started",
    reviewId,
    filesTotal: parsed.files.length,
    timestamp: new Date().toISOString(),
  } satisfies ReviewStartedEvent);

  if (files && files.length > 0) {
    parsed = filterDiffByFiles(parsed, files);
    if (parsed.files.length === 0) {
      throw reviewAbort(
        `None of the specified files have ${mode} changes`,
        "NO_DIFF",
      );
    }
  }

  if (parsed.totalStats.totalSizeBytes > MAX_DIFF_SIZE_BYTES) {
    const sizeMB = (parsed.totalStats.totalSizeBytes / 1024 / 1024).toFixed(2);
    const maxMB = (MAX_DIFF_SIZE_BYTES / 1024 / 1024).toFixed(2);
    throw reviewAbort(
      `Diff too large (${sizeMB}MB exceeds ${maxMB}MB limit). Try reviewing fewer files or use file filtering.`,
      ErrorCode.VALIDATION_ERROR,
    );
  }

  return parsed;
}

export async function resolveReviewConfig(params: {
  lensIds?: LensId[];
  profileId?: ProfileId;
  projectPath: string;
  emit: EmitFn;
}): Promise<ResolvedConfig> {
  const { lensIds, profileId, projectPath, emit } = params;

  const profile = profileId ? getProfile(profileId) : undefined;
  const settings = getSettings();
  const activeLenses = lensIds ??
    profile?.lenses ??
    settings.defaultLenses ?? ["correctness"];

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

export async function executeReview(params: {
  aiClient: AIClient;
  parsed: ParsedDiff;
  config: ResolvedConfig;
  emit: EmitFn;
  signal?: AbortSignal;
}): Promise<ReviewOutcome> {
  const { aiClient, parsed, config, emit, signal } = params;

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
      signal,
    },
  );

  if (!result.ok) {
    throw reviewAbort(result.error.message, "AI_ERROR", "review");
  }

  await emit(stepComplete("review"));

  return { issues: result.value.issues, summary: result.value.summary };
}

export async function finalizeReview(params: {
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
  signal?: AbortSignal;
}): Promise<ReviewResult> {
  const {
    outcome,
    gitService,
    emit,
    reviewId,
    projectPath,
    mode,
    parsed,
    profileId,
    activeLenses,
    startTime,
    signal,
  } = params;

  await emit(stepStart("enrich"));

  const enrichedIssues = await enrichIssues(
    outcome.issues,
    gitService,
    async (event: EnrichProgressEvent) => {
      await emit(event);
    },
    signal,
  );

  await emit(stepComplete("enrich"));

  await emit(stepStart("report"));

  const finalResult = generateReport(enrichedIssues, outcome.summary);

  await emit(stepComplete("report"));

  const status = await gitService.getStatus().catch(() => null);
  signal?.throwIfAborted();

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
    throw reviewAbort(saveResult.error.message, ErrorCode.INTERNAL_ERROR);
  }

  return finalResult;
}

function stepStart(step: StepId) {
  return {
    type: "step_start" as const,
    step,
    timestamp: new Date().toISOString(),
  };
}

function stepComplete(step: StepId) {
  return {
    type: "step_complete" as const,
    step,
    timestamp: new Date().toISOString(),
  };
}
