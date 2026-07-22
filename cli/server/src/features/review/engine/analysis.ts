import type { Result } from "@diffgazer/core/result";
import { err, ok } from "@diffgazer/core/result";
import type { AgentStreamEvent, StepEvent } from "@diffgazer/core/schemas/events";
import { AGENT_METADATA, LENS_TO_AGENT } from "@diffgazer/core/schemas/events";
import type {
  Lens,
  LensReviewResult,
  ReviewIssue,
  SeverityFilter,
} from "@diffgazer/core/schemas/review";
import { LensReviewResultSchema } from "@diffgazer/core/schemas/review";
import { pluralize } from "@diffgazer/core/strings";
import type { AIClient, AIError } from "../../../shared/lib/ai/types.js";
import type { ParsedDiff } from "./diff/types.js";
import { createIssueEvidenceResolver } from "./issues/evidence.js";
import {
  normalizeIssueLineFields,
  normalizeIssueTextFields,
  validateIssueCompleteness,
} from "./issues/normalization.js";
import { severityMeetsMinimum } from "./issues/ordering.js";
import { buildReviewPrompt } from "./prompts.js";
import { sanitizeIssue } from "./sanitize-issue.js";
import type { LensResult } from "./types.js";

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

function resolvePromptFileIdentities(
  issue: ReviewIssue,
  filePathsById: ReadonlyMap<string, string>,
): ReviewIssue | null {
  const filePath = filePathsById.get(issue.file);
  if (filePath === undefined) return null;

  const evidence: ReviewIssue["evidence"] = [];
  for (const reference of issue.evidence) {
    if (reference.file === undefined) {
      evidence.push(reference.type === "code" ? { ...reference, file: filePath } : reference);
      continue;
    }
    const evidenceFilePath = filePathsById.get(reference.file);
    if (evidenceFilePath === undefined) return null;
    evidence.push({ ...reference, file: evidenceFilePath });
  }

  let fixPlan: ReviewIssue["fixPlan"];
  if (issue.fixPlan) {
    fixPlan = [];
    for (const step of issue.fixPlan) {
      if (step.files === undefined) {
        fixPlan.push(step);
        continue;
      }
      const files: string[] = [];
      for (const fileId of step.files) {
        const resolvedFile = filePathsById.get(fileId);
        if (resolvedFile === undefined) return null;
        files.push(resolvedFile);
      }
      fixPlan.push({ ...step, files });
    }
  }

  return { ...issue, file: filePath, evidence, fixPlan };
}

export async function runLensAnalysis(
  client: AIClient,
  lens: Lens,
  diff: ParsedDiff,
  onEvent: (event: AgentStreamEvent | StepEvent) => void,
  projectContext?: string,
  signal?: AbortSignal,
  severityFilter?: SeverityFilter,
): Promise<Result<LensResult, AIError>> {
  const agentId = LENS_TO_AGENT[lens.id];
  const agentMeta = AGENT_METADATA[agentId];
  const startedAt = Date.now();

  onEvent({
    type: "agent_start",
    agent: agentMeta,
    timestamp: new Date().toISOString(),
  });

  onEvent({
    type: "agent_thinking",
    agent: agentId,
    thought: getThinkingMessage(lens),
    timestamp: new Date().toISOString(),
  });

  onEvent({
    type: "agent_progress",
    agent: agentId,
    progress: 15,
    message: `Gathering context (${diff.files.length} files)`,
    timestamp: new Date().toISOString(),
  });

  const { text: prompt, files: promptFiles } = buildReviewPrompt(lens, diff, projectContext);

  for (const [index, { file }] of promptFiles.entries()) {
    onEvent({
      type: "file_progress",
      agent: agentId,
      file: file.filePath,
      completed: index + 1,
      total: promptFiles.length,
      timestamp: new Date().toISOString(),
    });
  }

  onEvent({
    type: "agent_progress",
    agent: agentId,
    progress: 60,
    message: `Prompt includes ${pluralize(promptFiles.length, "file")} and ${pluralize(countDiffLines(diff), "diff line")}`,
    timestamp: new Date().toISOString(),
  });

  onEvent({
    type: "agent_progress",
    agent: agentId,
    progress: 65,
    message: "Waiting for model response",
    timestamp: new Date().toISOString(),
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
    });
  }, 2000);

  let result: Result<LensReviewResult, AIError>;
  try {
    result = await client.generate(prompt, LensReviewResultSchema, { signal });
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
    });
    return result;
  }

  const filePathsById = new Map(promptFiles.map(({ id, file }) => [id, file.filePath]));
  const ensureEvidence = createIssueEvidenceResolver(diff);
  const resolvedIssues: ReviewIssue[] = [];
  for (const issue of result.value.issues) {
    const resolvedIssue = resolvePromptFileIdentities(
      normalizeIssueTextFields(issue),
      filePathsById,
    );
    if (resolvedIssue === null) {
      const error: AIError = {
        code: "PARSE_ERROR",
        message: "Model response referenced an unknown file identity.",
      };
      onEvent({
        type: "agent_error",
        agent: agentId,
        error: `${error.code}: ${error.message}`,
        timestamp: new Date().toISOString(),
      });
      return err(error);
    }
    resolvedIssues.push(resolvedIssue);
  }

  const normalizedIssues = resolvedIssues
    .map((issue: ReviewIssue) => normalizeIssueLineFields(issue))
    .map((issue: ReviewIssue) => ensureEvidence(issue))
    .map((issue: ReviewIssue) => sanitizeIssue(issue));
  const completeIssues = normalizedIssues.filter(validateIssueCompleteness);
  const droppedIncompleteProviderIssues = normalizedIssues.length - completeIssues.length;
  const processedIssues = ensureUniqueIssueIds(completeIssues, lens.id);

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
    });
  }

  onEvent({
    type: "agent_progress",
    agent: agentId,
    progress: 90,
    message: `Found ${pluralize(streamedIssues.length, "issue")}`,
    timestamp: new Date().toISOString(),
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
  });

  return ok({
    lensId: lens.id,
    issues: processedIssues,
    droppedIncompleteProviderIssues,
  });
}
