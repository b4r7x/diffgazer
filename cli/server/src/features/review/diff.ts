import { err, ok, type Result } from "@diffgazer/core/result";
import type { ReviewStartedEvent } from "@diffgazer/core/schemas/events";
import { ReviewErrorCode, type ReviewMode } from "@diffgazer/core/schemas/review";
import { createGitDiffError } from "../../shared/lib/git/errors.js";
import type { createGitService } from "../../shared/lib/git/service.js";
import { type ReviewAbort, reviewAbort } from "./abort.js";
import { parseDiff } from "./engine/diff/parser.js";
import { computeTotalStats } from "./engine/diff/total-stats.js";
import type { ParsedDiff } from "./engine/diff/types.js";
import { stepComplete, stepStart } from "./stream/steps.js";
import type { EmitFn } from "./types.js";

export const MAX_DIFF_SIZE_BYTES = 512 * 1024;
const DIFFGAZER_DIR_PREFIX = ".diffgazer/";

function getReviewErrorCodeForGitDiff(error: Error): ReviewErrorCode {
  return error.message.startsWith("Git is not installed")
    ? ReviewErrorCode.GIT_NOT_FOUND
    : ReviewErrorCode.GENERATION_FAILED;
}

function getFilesModeNoDiffMessage(mode: ReviewMode): string {
  if (mode === "files") {
    return "None of the specified files have changes";
  }
  const changeScope = mode === "staged" ? "staged" : "unstaged";
  return `None of the specified files have ${changeScope} changes`;
}

function getModeNoDiffMessage(mode: ReviewMode): string {
  return mode === "staged"
    ? "No staged changes found. Use 'git add' to stage files, or review unstaged changes instead."
    : "No unstaged changes found. Make some edits first, or review staged changes instead.";
}

function isDiffgazerPath(filePath: string): boolean {
  const normalized = filePath.replace(/^\.\//, "");
  return normalized === ".diffgazer" || normalized.startsWith(DIFFGAZER_DIR_PREFIX);
}

export function filterDiffByFiles(parsed: ParsedDiff, files: string[]): ParsedDiff {
  if (files.length === 0) {
    return parsed;
  }

  const selectedFiles = new Set(files);
  const filteredFiles = parsed.files.filter((file) => selectedFiles.has(file.filePath));

  return { files: filteredFiles, totalStats: computeTotalStats(filteredFiles) };
}

export async function resolveGitDiff(params: {
  gitService: ReturnType<typeof createGitService>;
  mode: ReviewMode;
  files?: string[];
  emit: EmitFn;
  reviewId: string;
  signal?: AbortSignal;
}): Promise<Result<ParsedDiff, ReviewAbort>> {
  const { gitService, mode, files, emit, reviewId, signal } = params;

  signal?.throwIfAborted();
  await emit(stepStart("diff"));
  signal?.throwIfAborted();

  let diffResult: Result<string, { message: string }>;
  if (mode === "files") {
    if (!files || files.length === 0) {
      return err(
        reviewAbort(
          "files[] must be non-empty when mode is 'files'",
          ReviewErrorCode.GENERATION_FAILED,
          "diff",
        ),
      );
    }
    diffResult = await gitService.getDiff(mode, files, signal);
  } else if (files) {
    diffResult = await gitService.getDiff(mode, files, signal);
  } else {
    diffResult = await gitService.getDiff(mode, undefined, signal);
  }
  signal?.throwIfAborted();
  if (!diffResult.ok) {
    const gitDiffError = createGitDiffError(diffResult.error.message);
    return err(
      reviewAbort(gitDiffError.message, getReviewErrorCodeForGitDiff(gitDiffError), "diff"),
    );
  }
  const diff = diffResult.value;

  if (!diff.trim()) {
    return err(reviewAbort(getModeNoDiffMessage(mode), ReviewErrorCode.NO_DIFF, "diff"));
  }

  let parsed = parseDiff(diff);

  const externalFiles = parsed.files.filter((f) => !isDiffgazerPath(f.filePath));
  if (externalFiles.length !== parsed.files.length) {
    parsed = { files: externalFiles, totalStats: computeTotalStats(externalFiles) };
  }

  if (files && files.length > 0) {
    parsed = filterDiffByFiles(parsed, files);
  }

  if (parsed.files.length === 0) {
    const message =
      files && files.length > 0 ? getFilesModeNoDiffMessage(mode) : getModeNoDiffMessage(mode);
    return err(reviewAbort(message, ReviewErrorCode.NO_DIFF, "diff"));
  }

  if (parsed.totalStats.totalSizeBytes > MAX_DIFF_SIZE_BYTES) {
    const sizeMB = (parsed.totalStats.totalSizeBytes / 1024 / 1024).toFixed(2);
    const maxMB = (MAX_DIFF_SIZE_BYTES / 1024 / 1024).toFixed(2);
    return err(
      reviewAbort(
        `Diff too large (${sizeMB}MB exceeds ${maxMB}MB limit). Try reviewing fewer files or use file filtering.`,
        // Not a ReviewErrorCode of its own; surfaces as GENERATION_FAILED (the
        // same code the prior untyped collapse produced for this message).
        ReviewErrorCode.GENERATION_FAILED,
        "diff",
      ),
    );
  }

  await emit(stepComplete("diff"));
  signal?.throwIfAborted();

  await emit({
    type: "review_started",
    reviewId,
    filesTotal: parsed.files.length,
    timestamp: new Date().toISOString(),
  } satisfies ReviewStartedEvent);
  signal?.throwIfAborted();

  return ok(parsed);
}
