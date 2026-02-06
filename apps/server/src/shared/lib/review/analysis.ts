import { randomUUID } from "node:crypto";
import type { Lens } from "@stargazer/schemas/review";
import type {
  ReviewIssue,
  ReviewResult,
} from "@stargazer/schemas/review";
import { ReviewResultSchema } from "@stargazer/schemas/review";
import type { AgentStreamEvent, StepEvent } from "@stargazer/schemas/events";
import { AGENT_METADATA, LENS_TO_AGENT } from "@stargazer/schemas/events";
import type { AIClient, AIError } from "../ai/types.js";
import type { ParsedDiff } from "../diff/types.js";
import type { Result } from "@stargazer/core/result";
import { ok } from "@stargazer/core/result";
import { ensureIssueEvidence } from "./issues.js";
import { estimateTokens, getThinkingMessage } from "./utils.js";
import { buildReviewPrompt } from "./prompts.js";
import type { LensResult, AgentRunContext } from "./types.js";

export async function runLensAnalysis(
  client: AIClient,
  lens: Lens,
  diff: ParsedDiff,
  onEvent: (event: AgentStreamEvent | StepEvent) => void,
  context: AgentRunContext,
  projectContext?: string,
  signal?: AbortSignal
): Promise<Result<LensResult, AIError>> {
  const agentId = LENS_TO_AGENT[lens.id];
  const agentMeta = AGENT_METADATA[agentId];
  const startedAt = Date.now();
  const traceId = context.traceId;
  const spanId = context.spanId;
  const parentSpanId = context.parentSpanId;

  onEvent({
    type: "agent_start",
    agent: agentMeta,
    timestamp: new Date().toISOString(),
    traceId,
    spanId,
  });

  onEvent({
    type: "agent_thinking",
    agent: agentId,
    thought: getThinkingMessage(lens),
    timestamp: new Date().toISOString(),
    traceId,
    spanId,
  });

  onEvent({
    type: "agent_progress",
    agent: agentId,
    progress: 15,
    message: `Gathering context (${diff.files.length} files)`,
    timestamp: new Date().toISOString(),
    traceId,
    spanId,
  });

  for (let i = 0; i < diff.files.length; i++) {
    if (signal?.aborted) break;
    const file = diff.files[i]!;

    onEvent({
      type: "file_start",
      file: file.filePath,
      index: i,
      total: diff.files.length,
      timestamp: new Date().toISOString(),
      agent: agentId,
      scope: "agent",
      traceId,
      spanId,
      parentSpanId,
    });

    const lineCount = file.rawDiff.split("\n").length;
    const startLine = file.hunks[0]?.newStart ?? 1;
    const lastHunk = file.hunks[file.hunks.length - 1];
    const endLine = lastHunk ? lastHunk.newStart + lastHunk.newCount - 1 : startLine;

    const toolSpanId = randomUUID();
    onEvent({
      type: "tool_start",
      agent: agentId,
      tool: "readFileContext",
      input: `${file.filePath}:${startLine}-${endLine}`,
      timestamp: new Date().toISOString(),
      traceId,
      spanId: toolSpanId,
      parentSpanId: spanId,
    });

    onEvent({
      type: "tool_end",
      agent: agentId,
      tool: "readFileContext",
      summary: `Read ${lineCount} lines from ${file.filePath}`,
      status: "success",
      timestamp: new Date().toISOString(),
      traceId,
      spanId: toolSpanId,
      parentSpanId: spanId,
    });

    onEvent({
      type: "file_complete",
      file: file.filePath,
      index: i,
      total: diff.files.length,
      timestamp: new Date().toISOString(),
      agent: agentId,
      scope: "agent",
      traceId,
      spanId,
      parentSpanId,
    });

    const progress = diff.files.length > 0
      ? 15 + Math.round(((i + 1) / diff.files.length) * 35)
      : 50;
    onEvent({
      type: "agent_progress",
      agent: agentId,
      progress,
      message: `Scanned ${i + 1}/${diff.files.length} files`,
      timestamp: new Date().toISOString(),
      traceId,
      spanId,
    });
  }

  onEvent({
    type: "agent_thinking",
    agent: agentId,
    thought: `Analyzing ${diff.files.length} file${diff.files.length !== 1 ? "s" : ""} for ${lens.name.toLowerCase()} issues...`,
    timestamp: new Date().toISOString(),
    traceId,
    spanId,
  });

  onEvent({
    type: "agent_progress",
    agent: agentId,
    progress: 60,
    message: "Dispatching to model",
    timestamp: new Date().toISOString(),
    traceId,
    spanId,
  });

  const prompt = buildReviewPrompt(lens, diff, projectContext);

  let progressTimer: ReturnType<typeof setInterval> | null = null;
  const timerStart = Date.now();
  const progressStages = [
    { afterMs: 2000, progress: 70, message: "Model analyzing patterns" },
    { afterMs: 5000, progress: 80, message: "Scoring potential issues" },
    { afterMs: 8000, progress: 90, message: "Synthesizing findings" },
    { afterMs: 11000, progress: 95, message: "Final checks" },
  ];
  let stageIndex = 0;
  progressTimer = setInterval(() => {
    if (signal?.aborted) { clearInterval(progressTimer!); return; }
    const elapsedMs = Date.now() - timerStart;
    if (stageIndex >= progressStages.length) return;
    const stage = progressStages[stageIndex];
    if (stage && elapsedMs >= stage.afterMs) {
      stageIndex += 1;
      onEvent({
        type: "agent_progress",
        agent: agentId,
        progress: stage.progress,
        message: stage.message,
        timestamp: new Date().toISOString(),
        traceId,
        spanId,
      });
    }
  }, 500);

  let result: Result<ReviewResult, AIError>;
  try {
    result = await client.generate(prompt, ReviewResultSchema, { signal });
  } finally {
    if (progressTimer) clearInterval(progressTimer);
  }

  if (!result.ok) {
    const errorLabel = result.error.code ? `${result.error.code}: ${result.error.message}` : result.error.message;
    onEvent({
      type: "agent_error",
      agent: agentId,
      error: errorLabel,
      timestamp: new Date().toISOString(),
      traceId,
      spanId,
    });
    return result;
  }

  const issuesWithEvidence = result.value.issues.map((issue: ReviewIssue) => ensureIssueEvidence(issue, diff));

  for (const issue of issuesWithEvidence) {
    onEvent({
      type: "issue_found",
      agent: agentId,
      issue,
      timestamp: new Date().toISOString(),
      traceId,
      spanId,
    });
  }

  onEvent({
    type: "agent_progress",
    agent: agentId,
    progress: 90,
    message: `Found ${issuesWithEvidence.length} issue${issuesWithEvidence.length === 1 ? "" : "s"}`,
    timestamp: new Date().toISOString(),
    traceId,
    spanId,
  });

  onEvent({
    type: "agent_complete",
    agent: agentId,
    issueCount: issuesWithEvidence.length,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    promptChars: prompt.length,
    outputChars: JSON.stringify(result.value).length,
    tokenEstimate: estimateTokens(prompt),
    traceId,
    spanId,
  });

  return ok({
    lensId: lens.id,
    lensName: lens.name,
    summary: result.value.summary,
    issues: issuesWithEvidence,
  });
}

