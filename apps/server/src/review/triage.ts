import type { Result } from "@repo/core";
import { ok, err } from "@repo/core";
import type { AIClient, AIError } from "../ai/index.js";
import type { ParsedDiff, FileDiff } from "../diff/index.js";
import type { Lens } from "@repo/schemas/lens";
import type {
  TriageResult,
  TriageIssue,
  TriageSeverity,
  EvidenceRef,
  TriageOptions,
  SeverityFilter,
} from "@repo/schemas/triage";
import { TriageResultSchema } from "@repo/schemas/triage";
import type { AgentStreamEvent, LensStat } from "@repo/schemas/agent-event";
import { AGENT_METADATA, LENS_TO_AGENT } from "@repo/schemas/agent-event";
import type { StepEvent } from "@repo/schemas/step-event";
import { escapeXml } from "../lib/sanitization.js";
import { getLenses } from "./lenses/index.js";
import { getProfile } from "./profiles.js";

export type { TriageOptions };

export type TriageError = AIError | { code: "NO_DIFF"; message: string };

const SEVERITY_ORDER: Record<TriageSeverity, number> = {
  blocker: 0,
  high: 1,
  medium: 2,
  low: 3,
  nit: 4,
};

function severityMeetsMinimum(severity: TriageSeverity, minSeverity: TriageSeverity): boolean {
  return SEVERITY_ORDER[severity] <= SEVERITY_ORDER[minSeverity];
}

function filterIssuesBySeverity(issues: TriageIssue[], filter?: SeverityFilter): TriageIssue[] {
  if (!filter) return issues;
  return issues.filter((issue) => severityMeetsMinimum(issue.severity, filter.minSeverity));
}

function buildTriagePrompt(lens: Lens, diff: ParsedDiff): string {
  const filesContext = diff.files
    .map((f) => `- ${f.filePath} (${f.operation}, +${f.stats.additions}/-${f.stats.deletions})`)
    .join("\n");

  const diffs = diff.files
    .map((f) => `<code-diff file="${escapeXml(f.filePath)}">\n${escapeXml(f.rawDiff)}\n</code-diff>`)
    .join("\n\n");

  return `${lens.systemPrompt}

<severity-rubric>
- blocker: ${lens.severityRubric.blocker}
- high: ${lens.severityRubric.high}
- medium: ${lens.severityRubric.medium}
- low: ${lens.severityRubric.low}
- nit: ${lens.severityRubric.nit}
</severity-rubric>

<files-changed>
${filesContext}
</files-changed>

${diffs}

Analyze ONLY the code changes shown above through the "${lens.name}" lens.

For each issue found, provide:
- id: unique identifier (lens_category_number, e.g., "correctness_null_1")
- severity: blocker|high|medium|low|nit (use the rubric above)
- category: correctness|security|performance|api|tests|readability|style
- title: brief issue title
- file: the file path containing the issue
- line_start: starting line number (null if not applicable)
- line_end: ending line number (null if not applicable)
- rationale: detailed explanation of why this is an issue
- recommendation: specific action to fix the issue
- suggested_patch: unified diff patch to fix (null if complex)
- confidence: 0.0-1.0 confidence in the finding
- symptom: what observable behavior or code pattern indicates the problem
- whyItMatters: business/technical impact explaining why this needs attention
- fixPlan: optional array of step-by-step fix instructions [{step: 1, action: "...", files: ["..."], risk: "low|medium|high"}]
- betterOptions: optional array of alternative approaches to consider
- testsToAdd: optional array of test cases that should be added
- evidence: array of evidence references supporting the finding, each with:
  - type: "code"|"doc"|"trace"|"external"
  - title: brief description
  - sourceId: unique identifier for the source
  - file: file path (for code evidence)
  - range: {start: line, end: line} (for code evidence)
  - excerpt: relevant code snippet or quote

Respond with JSON: { "summary": "...", "issues": [...] }`;
}

function deduplicateIssues(allIssues: TriageIssue[]): TriageIssue[] {
  const seen = new Map<string, TriageIssue>();

  for (const issue of allIssues) {
    const key = `${issue.file}:${issue.line_start}:${issue.title.toLowerCase().slice(0, 50)}`;
    const existing = seen.get(key);

    if (!existing || SEVERITY_ORDER[issue.severity] < SEVERITY_ORDER[existing.severity]) {
      seen.set(key, issue);
    }
  }

  return Array.from(seen.values());
}

function sortIssuesBySeverity(issues: TriageIssue[]): TriageIssue[] {
  return [...issues].sort((a, b) => {
    const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return a.file.localeCompare(b.file);
  });
}

function extractEvidenceFromDiff(file: FileDiff, lineStart: number | null, lineEnd: number | null): EvidenceRef[] {
  if (lineStart === null) return [];

  const matchingHunk = file.hunks.find((hunk) => {
    const hunkEnd = hunk.newStart + hunk.newCount - 1;
    return lineStart >= hunk.newStart && lineStart <= hunkEnd;
  });

  if (!matchingHunk) return [];

  const lines = matchingHunk.content.split("\n");
  const relativeStart = lineStart - matchingHunk.newStart;
  const relativeEnd = lineEnd !== null ? lineEnd - matchingHunk.newStart : relativeStart;
  const excerpt = lines.slice(relativeStart, relativeEnd + 1).join("\n");

  return [
    {
      type: "code" as const,
      title: `Code at ${file.filePath}:${lineStart}`,
      sourceId: `${file.filePath}:${lineStart}-${lineEnd ?? lineStart}`,
      file: file.filePath,
      range: { start: lineStart, end: lineEnd ?? lineStart },
      excerpt: excerpt || lines.slice(0, 5).join("\n"),
    },
  ];
}

function ensureIssueEvidence(issue: TriageIssue, diff: ParsedDiff): TriageIssue {
  if (issue.evidence && issue.evidence.length > 0) {
    return issue;
  }

  const file = diff.files.find((f) => f.filePath === issue.file);
  if (!file) {
    return {
      ...issue,
      evidence: [
        {
          type: "code" as const,
          title: `Issue in ${issue.file}`,
          sourceId: issue.file,
          file: issue.file,
          excerpt: issue.rationale,
        },
      ],
    };
  }

  const extractedEvidence = extractEvidenceFromDiff(file, issue.line_start, issue.line_end);
  return {
    ...issue,
    evidence:
      extractedEvidence.length > 0
        ? extractedEvidence
        : [
            {
              type: "code" as const,
              title: `Issue in ${issue.file}`,
              sourceId: issue.file,
              file: issue.file,
              excerpt: issue.rationale,
            },
          ],
  };
}

function validateIssueCompleteness(issue: TriageIssue): boolean {
  return Boolean(
    issue.id &&
      issue.severity &&
      issue.category &&
      issue.title &&
      issue.file &&
      issue.rationale &&
      issue.recommendation &&
      issue.symptom &&
      issue.whyItMatters &&
      issue.evidence &&
      issue.evidence.length > 0
  );
}

function now(): string {
  return new Date().toISOString();
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

interface LensResult {
  lensId: Lens["id"];
  lensName: string;
  summary: string;
  issues: TriageIssue[];
}

async function runLensAnalysis(
  client: AIClient,
  lens: Lens,
  diff: ParsedDiff,
  onEvent: (event: AgentStreamEvent | StepEvent) => void
): Promise<Result<LensResult, TriageError>> {
  const agentId = LENS_TO_AGENT[lens.id];
  const agentMeta = AGENT_METADATA[agentId];

  onEvent({
    type: "agent_start",
    agent: agentMeta,
    timestamp: now(),
  });

  onEvent({
    type: "agent_thinking",
    agent: agentId,
    thought: getThinkingMessage(lens),
    timestamp: now(),
  });

  for (const file of diff.files) {
    const lineCount = file.rawDiff.split("\n").length;
    const startLine = file.hunks[0]?.newStart ?? 1;
    const lastHunk = file.hunks[file.hunks.length - 1];
    const endLine = lastHunk ? lastHunk.newStart + lastHunk.newCount - 1 : startLine;

    onEvent({
      type: "tool_call",
      agent: agentId,
      tool: "readFileContext",
      input: `${file.filePath}:${startLine}-${endLine}`,
      timestamp: now(),
    });

    onEvent({
      type: "tool_result",
      agent: agentId,
      tool: "readFileContext",
      summary: `Read ${lineCount} lines from ${file.filePath}`,
      timestamp: now(),
    });
  }

  onEvent({
    type: "agent_thinking",
    agent: agentId,
    thought: `Analyzing ${diff.files.length} file${diff.files.length !== 1 ? "s" : ""} for ${lens.name.toLowerCase()} issues...`,
    timestamp: now(),
  });

  const prompt = buildTriagePrompt(lens, diff);
  const result = await client.generate(prompt, TriageResultSchema);

  if (!result.ok) {
    return result;
  }

  const issuesWithEvidence = result.value.issues.map((issue) => ensureIssueEvidence(issue, diff));

  for (const issue of issuesWithEvidence) {
    onEvent({
      type: "issue_found",
      agent: agentId,
      issue,
      timestamp: now(),
    });
  }

  onEvent({
    type: "agent_complete",
    agent: agentId,
    issueCount: issuesWithEvidence.length,
    timestamp: now(),
  });

  return ok({
    lensId: lens.id,
    lensName: lens.name,
    summary: result.value.summary,
    issues: issuesWithEvidence,
  });
}

export async function triageReviewStream(
  client: AIClient,
  diff: ParsedDiff,
  options: TriageOptions = {},
  onEvent: (event: AgentStreamEvent | StepEvent) => void
): Promise<Result<TriageResult, TriageError>> {
  if (diff.files.length === 0) {
    return err({ code: "NO_DIFF", message: "No files changed" });
  }

  const lensIds = options.lenses ?? options.profile?.lenses ?? ["correctness"];
  const lenses = getLenses(lensIds);
  const filter = options.filter ?? options.profile?.filter;

  const lensPromises = lenses.map((lens) => runLensAnalysis(client, lens, diff, onEvent));
  const settledResults = await Promise.allSettled(lensPromises);

  const allIssues: TriageIssue[] = [];
  const summaries: string[] = [];
  const lensStats: LensStat[] = [];
  let lastError: TriageError | null = null;

  settledResults.forEach((settled, i) => {
    const lens = lenses[i];
    if (!lens) return;

    if (settled.status === "rejected") {
      lastError = { code: "NETWORK_ERROR" as const, message: String(settled.reason) };
      lensStats.push({ lensId: lens.id, issueCount: 0, status: "failed" });
      return;
    }

    const result = settled.value;
    if (!result.ok) {
      lastError = result.error;
      lensStats.push({ lensId: lens.id, issueCount: 0, status: "failed" });
      return;
    }

    allIssues.push(...result.value.issues);
    summaries.push(`[${result.value.lensName}] ${result.value.summary}`);
    lensStats.push({ lensId: result.value.lensId, issueCount: result.value.issues.length, status: "success" });
  });

  if (allIssues.length === 0 && lastError !== null) {
    return err(lastError);
  }

  const deduplicated = deduplicateIssues(allIssues);
  const filtered = filterIssuesBySeverity(deduplicated, filter);
  const validated = filtered.filter(validateIssueCompleteness);
  const sorted = sortIssuesBySeverity(validated);

  const combinedSummary = summaries.join("\n\n");

  onEvent({
    type: "orchestrator_complete",
    summary: combinedSummary,
    totalIssues: sorted.length,
    lensStats,
    filesAnalyzed: diff.files.length,
    timestamp: now(),
  });

  return ok({
    summary: combinedSummary,
    issues: sorted,
  });
}

export async function triageReview(
  client: AIClient,
  diff: ParsedDiff,
  options: TriageOptions = {}
): Promise<Result<TriageResult, TriageError>> {
  return triageReviewStream(client, diff, options, () => {});
}

export { getLenses, getProfile };
