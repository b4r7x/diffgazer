import { z } from "zod";
import { type Result, ok, err } from "@stargazer/core";
import type { DrilldownResult } from "@stargazer/schemas/lens";
import type { TraceRef, ReviewIssue, ReviewResult } from "@stargazer/schemas/review";
import type { AgentStreamEvent } from "@stargazer/schemas/agent-event";
import type { AIClient, AIError } from "../../shared/lib/ai/types.js";
import type { FileDiff, ParsedDiff } from "../../shared/lib/diff/types.js";
import { now } from "../../shared/lib/review/utils.js";
import { buildDrilldownPrompt } from "../../shared/lib/review/prompts.js";

export type DrilldownError = AIError | { code: "ISSUE_NOT_FOUND"; message: string };

export const DrilldownResponseSchema = z.object({
  detailedAnalysis: z.string(),
  rootCause: z.string(),
  impact: z.string(),
  suggestedFix: z.string(),
  patch: z.string().nullable(),
  relatedIssues: z.array(z.string()),
  references: z.array(z.string()),
});

type DrilldownResponse = z.infer<typeof DrilldownResponseSchema>;

export function summarizeOutput(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value === "string") {
    const lines = value.split("\n").length;
    const chars = value.length;
    if (chars > 100) {
      return `${chars} chars, ${lines} lines`;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return `Array[${value.length}]`;
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);
    return `Object{${keys.slice(0, 3).join(", ")}${keys.length > 3 ? ", ..." : ""}}`;
  }

  return String(value);
}

export async function recordTrace<T>(
  steps: TraceRef[],
  toolName: string,
  inputSummary: string,
  fn: () => Promise<T>
): Promise<T> {
  const step = steps.length + 1;
  const timestamp = new Date().toISOString();
  const result = await fn();
  steps.push({
    step,
    tool: toolName,
    inputSummary,
    outputSummary: summarizeOutput(result),
    timestamp,
  });
  return result;
}

interface DrilldownOptions {
  traceSteps?: TraceRef[];
  onEvent?: (event: AgentStreamEvent) => void;
}

export async function drilldownIssue(
  client: AIClient,
  issue: ReviewIssue,
  diff: ParsedDiff,
  allIssues: ReviewIssue[] = [],
  options?: DrilldownOptions
): Promise<Result<DrilldownResult, DrilldownError>> {
  const steps: TraceRef[] = options?.traceSteps ?? [];
  const onEvent = options?.onEvent ?? (() => {});

  const targetFile = diff.files.find((f: FileDiff) => f.filePath === issue.file);
  if (targetFile) {
    const lineCount = targetFile.rawDiff.split("\n").length;
    const startLine = issue.line_start ?? targetFile.hunks[0]?.newStart ?? 1;
    const endLine = issue.line_end ?? startLine;

    onEvent({
      type: "tool_call",
      agent: "detective",
      tool: "readFileContext",
      input: `${targetFile.filePath}:${startLine}-${endLine}`,
      timestamp: now(),
    });

    onEvent({
      type: "tool_result",
      agent: "detective",
      tool: "readFileContext",
      summary: `Read ${lineCount} lines from ${targetFile.filePath}`,
      timestamp: now(),
    });
  }

  const prompt = buildDrilldownPrompt(issue, diff, allIssues);

  const result: Result<DrilldownResponse, AIError> = await recordTrace(
    steps,
    "generateAnalysis",
    `issue analysis: ${issue.id} - ${issue.title}`,
    () => client.generate(prompt, DrilldownResponseSchema)
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
  options?: DrilldownOptions
): Promise<Result<DrilldownResult, DrilldownError>> {
  const issue = reviewResult.issues.find((i) => i.id === issueId);

  if (!issue) {
    return err({ code: "ISSUE_NOT_FOUND", message: `Issue with ID "${issueId}" not found` });
  }

  return drilldownIssue(client, issue, diff, reviewResult.issues, options);
}
