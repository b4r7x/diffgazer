import type { AIClient, StreamMetadata } from "../ai/index.js";
import type { ReviewResult, FileReviewResult } from "@repo/schemas/review";
import type { Result, AppError } from "@repo/core";
import { ReviewIssueSchema, ScoreSchema } from "@repo/schemas/review";
import { getErrorMessage, truncate, ok, err, createError, safeParseJson } from "@repo/core";
import { chunk } from "../lib/array.js";
import { escapeXml } from "../lib/sanitization.js";
import { validateSchema } from "../lib/validation.js";
import { z } from "zod";
import { parseDiff, type FileDiff } from "../diff/index.js";
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

async function getDiffForReview(
  staged: boolean,
  projectPath?: string
): Promise<Result<FileDiff[], AppError>> {
  const gitService = createGitService({ cwd: projectPath });
  const diff = await gitService.getDiff(staged);

  if (!diff.trim()) {
    return err(createError("NO_CHANGES", `No ${staged ? "staged" : "unstaged"} changes to review`));
  }

  const parsed = parseDiff(diff);
  return ok(parsed.files);
}

function createReviewBatches(
  files: FileDiff[],
  batchSize: number = DEFAULT_BATCH_SIZE
): FileDiff[][] {
  return chunk(files, batchSize);
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
    onComplete: async () => {},
    onError: async (error) => { throw error; },
  });

  return parseFileReviewResult(file.filePath, content);
}

function buildFilePrompt(file: FileDiff): string {
  // CVE-2025-53773: Escape user content to prevent prompt injection
  const escapedPath = escapeXml(file.filePath);
  const escapedDiff = escapeXml(file.rawDiff);

  return `Review the following file changes and provide feedback.
File: ${escapedPath}
Operation: ${file.operation}
Changes: +${file.stats.additions}/-${file.stats.deletions}

\`\`\`diff
${escapedDiff}
\`\`\`

Respond with JSON only: { "summary": "...", "issues": [...], "score": 0-10 }
Each issue: { "severity": "critical|warning|suggestion|nitpick", "category": "security|performance|style|logic|documentation|best-practice", "file": "${escapedPath}", "line": number or null, "title": "...", "description": "...", "suggestion": "fix or null" }`;
}

interface ParseError {
  message: string;
  details?: string;
}

const AIFileReviewResponseSchema = z.object({
  summary: z.string(),
  issues: z.array(ReviewIssueSchema),
  score: ScoreSchema,
});

function createParseErrorResult(filePath: string, errorMessage: string, content: string): FileReviewResult {
  console.error(
    `[PARSE_ERROR] Failed to parse AI review response for ${filePath}. ` +
    `Error: ${errorMessage}. ` +
    `Raw content (first 500 chars): ${truncate(content, 500)}`
  );

  return {
    filePath,
    summary: `[Parse Error] AI response could not be parsed. Raw output: ${truncate(content, 200)}`,
    issues: [],
    score: null,
    parseError: true,
    parseErrorMessage: errorMessage,
  };
}

export function parseFileReviewResult(filePath: string, content: string): FileReviewResult {
  const parseResult = safeParseJson<ParseError>(content, (message, details) => ({ message, details }));

  if (!parseResult.ok) {
    const errorMessage = parseResult.error.details
      ? `${parseResult.error.message}: ${parseResult.error.details}`
      : parseResult.error.message;
    return createParseErrorResult(filePath, errorMessage, content);
  }

  const validationResult = validateSchema(
    parseResult.value,
    AIFileReviewResponseSchema,
    (message) => ({ message })
  );

  if (!validationResult.ok) {
    return createParseErrorResult(filePath, validationResult.error.message, content);
  }

  const response = validationResult.value;
  return {
    filePath,
    summary: response.summary,
    issues: response.issues,
    score: response.score,
    parseError: false,
  };
}

export async function reviewDiffChunked(
  aiClient: AIClient,
  staged: boolean,
  callbacks: ChunkedReviewCallbacks
): Promise<void> {
  const diffResult = await getDiffForReview(staged);
  if (!diffResult.ok) {
    await callbacks.onError(new Error(diffResult.error.message));
    return;
  }
  const files = diffResult.value;

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
