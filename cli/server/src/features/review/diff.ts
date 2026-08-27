import { err, ok, type Result } from "@diffgazer/core/result";
import type { ReviewStartedEvent } from "@diffgazer/core/schemas/events";
import { ReviewErrorCode, type ReviewMode } from "@diffgazer/core/schemas/review";
import { createGitDiffError, type GitDiffError } from "../../shared/lib/git/errors.js";
import type { createGitService } from "../../shared/lib/git/service.js";
import { log } from "../../shared/lib/log.js";
import { type ReviewAbort, reviewAbort } from "./abort.js";
import { parseDiff } from "./engine/diff/parser.js";
import { computeTotalStats } from "./engine/diff/total-stats.js";
import type { ParsedDiff } from "./engine/diff/types.js";
import { stepComplete, stepStart } from "./stream/steps.js";
import type { EmitFn } from "./types.js";

/**
 * The one hard byte ceiling left on a diff. It is not the model gate — that is
 * `evaluateReviewCapacity`, which prices the diff against the selected model's
 * context window and knows how many tokens it would actually cost. This ceiling
 * only catches the pathological input no model choice would rescue: a committed
 * lockfile, a vendored tree, or a generated bundle arriving as megabytes of text.
 */
export const MAX_DIFF_SIZE_BYTES = 10 * 1024 * 1024;
const DIFFGAZER_DIR_PREFIX = ".diffgazer/";

function getReviewErrorCodeForGitDiff(error: GitDiffError): ReviewErrorCode {
  return error.code === "GIT_NOT_FOUND"
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

function hasCombinedDiffBlocks(diff: string): boolean {
  return /^diff --cc /m.test(diff) || /^@@@ /m.test(diff);
}

function mergeConflictMessage(conflicted: readonly string[]): string {
  if (conflicted.length === 1) {
    return `Review excludes 1 conflicted file with unresolved merge conflicts (${conflicted[0]}). Resolve conflicts first.`;
  }
  return `Review excludes ${conflicted.length} conflicted files with unresolved merge conflicts (${conflicted.join(", ")}). Resolve conflicts first.`;
}

function mergeConflictNotice(conflicted: readonly string[]): string {
  return `[diffgazer] ${mergeConflictMessage(conflicted)}`;
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

  // `getDiff` overloads a pathspec list onto the modes that accept one, and only
  // `files` mode requires it, so the call is spelled once with pathspecs and once
  // without rather than three times.
  let diffResult: Result<string, { message: string }>;
  if (files && files.length > 0) {
    diffResult = await gitService.getDiff(mode, files, signal);
  } else if (mode === "files") {
    return err(
      reviewAbort(
        "files[] must be non-empty when mode is 'files'",
        ReviewErrorCode.GENERATION_FAILED,
        "diff",
      ),
    );
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
    const message =
      files && files.length > 0 ? getFilesModeNoDiffMessage(mode) : getModeNoDiffMessage(mode);
    return err(reviewAbort(message, ReviewErrorCode.NO_DIFF, "diff"));
  }

  let parsed = parseDiff(diff);

  if (hasCombinedDiffBlocks(diff)) {
    const statusResult = await gitService.getStatus();
    const conflicted =
      statusResult.ok && statusResult.value.isGitRepo ? statusResult.value.conflicted : [];
    if (conflicted.length > 0) {
      const message = mergeConflictMessage(conflicted);
      if (parsed.files.length === 0) {
        return err(reviewAbort(message, ReviewErrorCode.GENERATION_FAILED, "diff"));
      }
      log("warn", "review_diff_merge_conflicts_excluded", { files: conflicted });
      await emit({ type: "chunk", content: mergeConflictNotice(conflicted) });
    }
  }

  const externalFiles = parsed.files.filter((f) => !isDiffgazerPath(f.filePath));
  if (externalFiles.length !== parsed.files.length) {
    parsed = { files: externalFiles, totalStats: computeTotalStats(externalFiles) };
  }

  if (files && files.length > 0) {
    parsed = filterDiffByFiles(parsed, files);
  }

  if (parsed.files.length === 0) {
    const hasUnresolvedConflicts = hasCombinedDiffBlocks(diff);
    const noDiffMessage =
      files && files.length > 0 ? getFilesModeNoDiffMessage(mode) : getModeNoDiffMessage(mode);
    const message = hasUnresolvedConflicts
      ? "Unresolved merge or rebase conflicts cannot be reviewed. Resolve conflicts first, then review your changes."
      : noDiffMessage;
    const errorCode = hasUnresolvedConflicts
      ? ReviewErrorCode.GENERATION_FAILED
      : ReviewErrorCode.NO_DIFF;
    return err(reviewAbort(message, errorCode, "diff"));
  }

  if (parsed.totalStats.totalSizeBytes > MAX_DIFF_SIZE_BYTES) {
    const sizeMB = (parsed.totalStats.totalSizeBytes / 1024 / 1024).toFixed(2);
    const maxMB = (MAX_DIFF_SIZE_BYTES / 1024 / 1024).toFixed(0);
    return err(
      reviewAbort(
        `Diff is ${sizeMB}MB, past the ${maxMB}MB ceiling a review will read at all. A diff this size is usually a lockfile, a vendored directory, or a generated bundle — exclude it, or review specific files.`,
        ReviewErrorCode.DIFF_TOO_LARGE,
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
