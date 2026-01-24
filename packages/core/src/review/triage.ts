import { z } from "zod";
import type { Result } from "../result.js";
import { ok, err } from "../result.js";
import type { AIClient } from "../ai/types.js";
import type { AIError } from "../ai/errors.js";
import type { ParsedDiff, FileDiff } from "../diff/types.js";
import type { Lens, LensId, ReviewProfile, SeverityFilter } from "@repo/schemas/lens";
import type { TriageResult, TriageIssue, TriageSeverity } from "@repo/schemas/triage";
import { TriageResultSchema } from "@repo/schemas/triage";
import { escapeXml } from "../sanitization.js";
import { getLenses, LENSES } from "./lenses/index.js";
import { getProfile } from "./profiles.js";

export interface TriageOptions {
  profile?: ReviewProfile;
  lenses?: LensId[];
  filter?: SeverityFilter;
}

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

export async function triageReview(
  client: AIClient,
  diff: ParsedDiff,
  options: TriageOptions = {}
): Promise<Result<TriageResult, TriageError>> {
  if (diff.files.length === 0) {
    return err({ code: "NO_DIFF", message: "No files changed" });
  }

  const lensIds = options.lenses ?? options.profile?.lenses ?? ["correctness"];
  const lenses = getLenses(lensIds);
  const filter = options.filter ?? options.profile?.filter;

  const allIssues: TriageIssue[] = [];
  const summaries: string[] = [];

  for (const lens of lenses) {
    const prompt = buildTriagePrompt(lens, diff);
    const result = await client.generate(prompt, TriageResultSchema);

    if (!result.ok) {
      return result;
    }

    allIssues.push(...result.value.issues);
    summaries.push(`[${lens.name}] ${result.value.summary}`);
  }

  const deduplicated = deduplicateIssues(allIssues);
  const filtered = filterIssuesBySeverity(deduplicated, filter);
  const sorted = sortIssuesBySeverity(filtered);

  return ok({
    summary: summaries.join("\n\n"),
    issues: sorted,
  });
}

export async function triageWithProfile(
  client: AIClient,
  diff: ParsedDiff,
  profileId: string
): Promise<Result<TriageResult, TriageError>> {
  const profile = getProfile(profileId as any);
  return triageReview(client, diff, { profile });
}
