import type { AIClient, StreamMetadata } from "@repo/core/ai";
import type { ReviewResult, FileReviewResult } from "@repo/schemas/review";
import { getErrorMessage, safeParseJson } from "@repo/core";
import { parseDiff, type FileDiff } from "@repo/core/diff";
import { createGitService } from "./git.js";
import { aggregateReviews } from "./review-aggregator.js";

const DEFAULT_BATCH_SIZE = 3;
const MAX_CONCURRENT_REVIEWS = 3;

export interface ChunkedReviewCallbacks {
  onFileStart: (file: string, index: number, total: number) => Promise<void>;
  onFileComplete: (file: string, result: FileReviewResult) => Promise<void>;
  onFileError: (file: string, error: Error) => Promise<void>;
  onProgress: (completed: number, total: number) => Promise<void>;
  onChunk: (chunk: string) => Promise<void>;
  onComplete: (aggregatedResult: ReviewResult, metadata?: StreamMetadata) => Promise<void>;
  onError: (error: Error) => Promise<void>;
}

/**
 * Retrieves and parses the git diff for review.
 * Returns parsed diff files or throws if no changes exist.
 */
async function getDiffForReview(
  staged: boolean,
  projectPath?: string
): Promise<FileDiff[]> {
  const gitService = createGitService({ cwd: projectPath });
  const diff = await gitService.getDiff(staged);

  if (!diff.trim()) {
    throw new Error(`No ${staged ? "staged" : "unstaged"} changes to review`);
  }

  const parsed = parseDiff(diff);
  return parsed.files;
}

/**
 * Creates batches of files for parallel processing.
 * Each batch contains up to batchSize files.
 */
function createReviewBatches(
  files: FileDiff[],
  batchSize: number = DEFAULT_BATCH_SIZE
): FileDiff[][] {
  const batches: FileDiff[][] = [];

  for (let i = 0; i < files.length; i += batchSize) {
    batches.push(files.slice(i, i + batchSize));
  }

  return batches;
}

async function reviewSingleFile(
  aiClient: AIClient,
  file: FileDiff,
  callbacks: Pick<ChunkedReviewCallbacks, "onChunk">
): Promise<FileReviewResult> {
  let content = "";

  await aiClient.generateStream(buildFilePrompt(file), {
    onChunk: async (chunk) => {
      content += chunk;
      await callbacks.onChunk(chunk);
    },
    onComplete: async () => { /* handled below */ },
    onError: async (error) => { throw error; },
  });

  return parseFileReviewResult(file.filePath, content);
}

function buildFilePrompt(file: FileDiff): string {
  return `Review the following file changes and provide feedback.
File: ${file.filePath}
Operation: ${file.operation}
Changes: +${file.stats.additions}/-${file.stats.deletions}

\`\`\`diff
${file.rawDiff}
\`\`\`

Respond with JSON only: { "summary": "...", "issues": [...], "score": 0-10 }
Each issue: { "severity": "critical|warning|suggestion|nitpick", "category": "security|performance|style|logic|documentation|best-practice", "file": "${file.filePath}", "line": number or null, "title": "...", "description": "...", "suggestion": "fix or null" }`;
}

interface ParseError {
  message: string;
  details?: string;
}

function validateFileReviewJson(json: unknown): ParseError | null {
  if (typeof json !== "object" || json === null) {
    return { message: "AI response is not a JSON object" };
  }

  const obj = json as Record<string, unknown>;
  const { summary, issues, score } = obj;

  if (typeof summary !== "string") {
    return { message: `Invalid summary: expected string, got ${typeof summary}` };
  }

  if (!Array.isArray(issues)) {
    return { message: `Invalid issues: expected array, got ${typeof issues}` };
  }

  if (score !== null && score !== undefined && typeof score !== "number") {
    return { message: `Invalid score: expected number or null, got ${typeof score}` };
  }

  return null;
}

function createParseErrorResult(filePath: string, errorMessage: string, content: string): FileReviewResult {
  console.error(
    `[PARSE_ERROR] Failed to parse AI review response for ${filePath}. ` +
    `Error: ${errorMessage}. ` +
    `Raw content (first 500 chars): ${content.slice(0, 500)}${content.length > 500 ? "..." : ""}`
  );

  return {
    filePath,
    summary: `[Parse Error] AI response could not be parsed. Raw output: ${content.slice(0, 200)}${content.length > 200 ? "..." : ""}`,
    issues: [],
    score: null,
    parseError: true,
    parseErrorMessage: errorMessage,
  };
}

function parseFileReviewResult(filePath: string, content: string): FileReviewResult {
  const parseResult = safeParseJson<ParseError>(content, (message, details) => ({ message, details }));

  if (!parseResult.ok) {
    const errorMessage = parseResult.error.details
      ? `${parseResult.error.message}: ${parseResult.error.details}`
      : parseResult.error.message;
    return createParseErrorResult(filePath, errorMessage, content);
  }

  const validationError = validateFileReviewJson(parseResult.value);
  if (validationError) {
    return createParseErrorResult(filePath, validationError.message, content);
  }

  const json = parseResult.value as Record<string, unknown>;
  return {
    filePath,
    summary: json.summary as string,
    issues: json.issues as FileReviewResult["issues"],
    score: (json.score as number) ?? null,
    parseError: false,
  };
}

/**
 * Reviews a git diff by processing files in batches with concurrency control.
 * Orchestrates: git diff retrieval -> batching -> parallel review -> aggregation
 */
export async function reviewDiffChunked(
  aiClient: AIClient,
  staged: boolean,
  callbacks: ChunkedReviewCallbacks
): Promise<void> {
  let files: FileDiff[];
  try {
    files = await getDiffForReview(staged);
  } catch (error) {
    await callbacks.onError(new Error(`Failed to get git diff: ${getErrorMessage(error)}`));
    return;
  }

  const batches = createReviewBatches(files, MAX_CONCURRENT_REVIEWS);
  const fileResults: FileReviewResult[] = [];
  const partialFailures: Array<{ file: string; error: string }> = [];
  let completedCount = 0;
  const totalFiles = files.length;

  for (const batch of batches) {
    const batchPromises = batch.map(async (file, batchIndex) => {
      const fileIndex = completedCount + batchIndex;
      await callbacks.onFileStart(file.filePath, fileIndex, totalFiles);

      try {
        const result = await reviewSingleFile(aiClient, file, callbacks);
        fileResults.push(result);
        await callbacks.onFileComplete(file.filePath, result);
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        partialFailures.push({ file: file.filePath, error: errorMessage });
        await callbacks.onFileError(file.filePath, error instanceof Error ? error : new Error(errorMessage));
      }
    });

    await Promise.all(batchPromises);
    completedCount += batch.length;
    await callbacks.onProgress(completedCount, totalFiles);
  }

  const aggregated = aggregateReviews(fileResults, partialFailures);
  await callbacks.onComplete(aggregated.result);
}
