import { createError } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type {
  DrilldownResult,
  ReviewIssue,
  ReviewResult,
  SavedReview,
  TraceRef,
} from "@diffgazer/core/schemas/review";
import type { AIClient, AIError } from "../../shared/lib/ai/types.js";
import type { ParsedDiff } from "./engine/diff/types.js";
import { buildDrilldownPrompt } from "./engine/prompts.js";
import type { DrilldownAIResponse } from "./schemas.js";
import { DrilldownResponseSchema } from "./schemas.js";
import { withReviewLock } from "./storage/review-lock.js";
import { addDrilldownToReview, getReview as getStoredReview } from "./storage/reviews.js";
import { recordTrace } from "./trace.js";
import type { DrilldownError, HandleDrilldownError } from "./types.js";

interface DrilldownOptions {
  traceSteps?: TraceRef[];
  signal?: AbortSignal;
}

interface HandleDrilldownOptions {
  review?: SavedReview;
  signal?: AbortSignal;
}

export async function drilldownIssue(
  client: AIClient,
  issue: ReviewIssue,
  diff: ParsedDiff,
  allIssues: ReviewIssue[] = [],
  options?: DrilldownOptions,
): Promise<Result<DrilldownResult, DrilldownError>> {
  const steps: TraceRef[] = options?.traceSteps ?? [];

  const prompt = buildDrilldownPrompt(issue, diff, allIssues);

  const signal = options?.signal;
  const result: Result<DrilldownAIResponse, AIError> = await recordTrace(
    steps,
    "generateAnalysis",
    `issue analysis: ${issue.id} - ${issue.title}`,
    () => client.generate(prompt, DrilldownResponseSchema, { signal }),
  );

  if (!result.ok) {
    return result;
  }

  const drilldownResult: DrilldownResult = {
    issueId: issue.id,
    issue,
    ...result.value,
    ...(steps.length > 0 ? { trace: [...steps] } : {}),
  };

  return ok(drilldownResult);
}

export async function drilldownIssueById(
  client: AIClient,
  issueId: string,
  reviewResult: ReviewResult,
  diff: ParsedDiff,
  options?: DrilldownOptions,
): Promise<Result<DrilldownResult, DrilldownError>> {
  const issue = reviewResult.issues.find((i) => i.id === issueId);

  if (!issue) {
    return err({
      code: "ISSUE_NOT_FOUND",
      message: `Issue with ID "${issueId}" not found`,
    });
  }

  return drilldownIssue(client, issue, diff, reviewResult.issues, {
    ...options,
    signal: options?.signal,
  });
}

export async function handleDrilldownRequest(
  client: AIClient,
  reviewId: string,
  issueId: string,
  projectPath: string,
  options: HandleDrilldownOptions = {},
): Promise<Result<DrilldownResult, HandleDrilldownError>> {
  const review = options.review;
  const reviewResult = review ? ok(review) : await getStoredReview(reviewId);
  if (!reviewResult.ok) return reviewResult;
  const savedReview = reviewResult.value;
  if (savedReview.metadata.projectPath !== projectPath) {
    return err(createError(ErrorCode.NOT_FOUND, "Review not found"));
  }

  const parsed = savedReview.diff;
  if (!parsed) {
    return err(createError(ErrorCode.COMMAND_FAILED, "Stored diff is missing for this review"));
  }

  const drilldownResult = await drilldownIssueById(client, issueId, savedReview.result, parsed, {
    signal: options.signal,
  });

  if (!drilldownResult.ok) return drilldownResult;

  const saveResult = await withReviewLock(reviewId, () =>
    addDrilldownToReview(reviewId, drilldownResult.value),
  );
  if (!saveResult.ok) return saveResult;

  return drilldownResult;
}
