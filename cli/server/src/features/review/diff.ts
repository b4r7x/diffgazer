import { err, ok, type Result } from "@diffgazer/core/result";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type {
  ReviewStartedEvent,
} from "@diffgazer/core/schemas/events";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { parseDiff } from "../../shared/lib/diff/parser.js";
import { computeTotalStats } from "../../shared/lib/diff/total-stats.js";
import type { ParsedDiff } from "../../shared/lib/diff/types.js";
import { createGitDiffError } from "../../shared/lib/git/errors.js";
import type { createGitService } from "../../shared/lib/git/service.js";
import { reviewAbort } from "./abort.js";
import { stepComplete, stepStart } from "./stream/steps.js";
import type { EmitFn, ReviewAbort } from "./types.js";

const MAX_DIFF_SIZE_BYTES = 524288; // 512KB
const DIFFGAZER_DIR_PREFIX = ".diffgazer/";

function isDiffgazerPath(filePath: string): boolean {
  const normalized = filePath.replace(/^\.\//, "");
  return normalized === ".diffgazer" || normalized.startsWith(DIFFGAZER_DIR_PREFIX);
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

  return { files: filteredFiles, totalStats: computeTotalStats(filteredFiles) };
}

export async function resolveGitDiff(params: {
  gitService: ReturnType<typeof createGitService>;
  mode: ReviewMode;
  files?: string[];
  emit: EmitFn;
  reviewId: string;
}): Promise<Result<ParsedDiff, ReviewAbort>> {
  const { gitService, mode, files, emit, reviewId } = params;

  await emit(stepStart("diff"));

  let diff: string;
  try {
    diff = await gitService.getDiff(mode, files);
  } catch (error: unknown) {
    return err(reviewAbort(
      createGitDiffError(error).message,
      ErrorCode.GIT_NOT_FOUND,
      "diff",
    ));
  }

  if (!diff.trim()) {
    const errorMessage =
      mode === "staged"
        ? "No staged changes found. Use 'git add' to stage files, or review unstaged changes instead."
        : "No unstaged changes found. Make some edits first, or review staged changes instead.";
    return err(reviewAbort(errorMessage, "NO_DIFF", "diff"));
  }

  let parsed = parseDiff(diff);

  const externalFiles = parsed.files.filter((f) => !isDiffgazerPath(f.filePath));
  if (externalFiles.length !== parsed.files.length) {
    parsed = { files: externalFiles, totalStats: computeTotalStats(externalFiles) };
  }

  if (files && files.length > 0) {
    parsed = filterDiffByFiles(parsed, files);
    if (parsed.files.length === 0) {
      return err(reviewAbort(
        `None of the specified files have ${mode} changes`,
        "NO_DIFF",
        "diff",
      ));
    }
  }

  if (parsed.totalStats.totalSizeBytes > MAX_DIFF_SIZE_BYTES) {
    const sizeMB = (parsed.totalStats.totalSizeBytes / 1024 / 1024).toFixed(2);
    const maxMB = (MAX_DIFF_SIZE_BYTES / 1024 / 1024).toFixed(2);
    return err(reviewAbort(
      `Diff too large (${sizeMB}MB exceeds ${maxMB}MB limit). Try reviewing fewer files or use file filtering.`,
      ErrorCode.VALIDATION_ERROR,
      "diff",
    ));
  }

  await emit(stepComplete("diff"));

  await emit({
    type: "review_started",
    reviewId,
    filesTotal: parsed.files.length,
    timestamp: new Date().toISOString(),
  } satisfies ReviewStartedEvent);

  return ok(parsed);
}
