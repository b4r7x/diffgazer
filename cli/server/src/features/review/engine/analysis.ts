import type { Result } from "@diffgazer/core/result";
import { ok } from "@diffgazer/core/result";
import { sanitizeTerminalText } from "@diffgazer/core/review";
import type { AgentStreamEvent, StepEvent } from "@diffgazer/core/schemas/events";
import { AGENT_METADATA, LENS_TO_AGENT } from "@diffgazer/core/schemas/events";
import type {
  Lens,
  ReviewIssue,
  ReviewResult,
  SeverityFilter,
} from "@diffgazer/core/schemas/review";
import { ReviewResultSchema } from "@diffgazer/core/schemas/review";
import { pluralize } from "@diffgazer/core/strings";
import type { AIClient, AIError } from "../../../shared/lib/ai/types.js";
import type { ParsedDiff } from "./diff/types.js";
import { ensureIssueEvidence, normalizeIssueLineFields, severityMeetsMinimum } from "./issues.js";
import { buildReviewPrompt } from "./prompts.js";
import { sanitizeIssue } from "./sanitize-issue.js";
import type { AgentRunContext, LensResult } from "./types.js";

function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function getThinkingMessage(lens: Lens): string {
  switch (lens.id) {
    case "correctness":
      return "Analyzing diff for bugs and logic errors...";
    case "security":
      return "Analyzing diff for security vulnerabilities...";
    case "performance":
      return "Analyzing diff for performance issues...";
    case "simplicity":
      return "Analyzing diff for complexity and maintainability...";
    case "tests":
      return "Analyzing diff for test coverage and quality...";
    default:
      return `Analyzing diff with ${lens.name} lens...`;
  }
}

function countDiffLines(diff: ParsedDiff): number {
  return diff.files.reduce((sum, file) => sum + file.rawDiff.split("\n").length, 0);
}

// Namespace ids by lens so the same raw id from independent lenses stays a
// distinct selection identity across the cross-lens merge (ids survive dedupe,
// which keys on file/line/title); a deterministic `#n` suffix separates
// same-raw-id duplicates within one lens.
function ensureUniqueIssueIds(issues: ReviewIssue[], lensId: Lens["id"]): ReviewIssue[] {
  const seen = new Set<string>();
  return issues.map((issue) => {
    const namespacedId = `${lensId}:${issue.id}`;
    let uniqueId = namespacedId;
    let attempt = 2;
    while (seen.has(uniqueId)) {
      uniqueId = `${namespacedId}#${attempt}`;
      attempt++;
    }
    seen.add(uniqueId);
    return { ...issue, id: uniqueId };
  });
}

export async function runLensAnalysis(
  client: AIClient,
  lens: Lens,
  diff: ParsedDiff,
  onEvent: (event: AgentStreamEvent | StepEvent) => void,
  context: AgentRunContext,
  projectContext?: string,
  signal?: AbortSignal,
  severityFilter?: SeverityFilter,
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

  for (const [i, file] of diff.files.entries()) {
    if (signal?.aborted) break;

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

    onEvent({
      type: "file_progress",
      agent: agentId,
      file: file.filePath,
      completed: i + 1,
      total: diff.files.length,
      timestamp: new Date().toISOString(),
      traceId,
      spanId,
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

    const progress =
      diff.files.length > 0 ? 15 + Math.round(((i + 1) / diff.files.length) * 35) : 50;
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

  const prompt = buildReviewPrompt(lens, diff, projectContext);

  onEvent({
    type: "agent_progress",
    agent: agentId,
    progress: 60,
    message: `Prompt built: ${pluralize(diff.files.length, "file")}, ${pluralize(countDiffLines(diff), "diff line")}`,
    timestamp: new Date().toISOString(),
    traceId,
    spanId,
  });

  let progressTimer: ReturnType<typeof setInterval> | null = null;
  const timerStart = Date.now();
  progressTimer = setInterval(() => {
    if (signal?.aborted) {
      if (progressTimer !== null) clearInterval(progressTimer);
      return;
    }
    const elapsedSec = Math.round((Date.now() - timerStart) / 1000);
    onEvent({
      type: "agent_progress",
      agent: agentId,
      progress: 65,
      message: `Waiting for model response — ${elapsedSec}s`,
      timestamp: new Date().toISOString(),
      traceId,
      spanId,
    });
  }, 2000);

  let result: Result<ReviewResult, AIError>;
  try {
    result = await client.generate(prompt, ReviewResultSchema, { signal });
  } finally {
    if (progressTimer) clearInterval(progressTimer);
  }

  if (!result.ok) {
    const errorLabel = result.error.code
      ? `${result.error.code}: ${result.error.message}`
      : result.error.message;
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

  const diffFilePaths = new Set(diff.files.map((f) => f.filePath));
  const processedIssues = ensureUniqueIssueIds(
    result.value.issues
      .filter((issue: ReviewIssue) => diffFilePaths.has(issue.file))
      .map((issue: ReviewIssue) => normalizeIssueLineFields(issue))
      .map((issue: ReviewIssue) => ensureIssueEvidence(issue, diff))
      .map((issue: ReviewIssue) => sanitizeIssue(issue)),
    lens.id,
  );

  // Stream only issues meeting the threshold; the full set is still returned.
  const streamedIssues = severityFilter
    ? processedIssues.filter((issue) =>
        severityMeetsMinimum(issue.severity, severityFilter.minSeverity),
      )
    : processedIssues;

  for (const issue of streamedIssues) {
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
    message: `Found ${pluralize(streamedIssues.length, "issue")}`,
    timestamp: new Date().toISOString(),
    traceId,
    spanId,
  });

  onEvent({
    type: "agent_complete",
    agent: agentId,
    issueCount: streamedIssues.length,
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
    summary: sanitizeTerminalText(result.value.summary),
    issues: processedIssues,
  });
}
