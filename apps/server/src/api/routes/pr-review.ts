import { Hono } from "hono";
import { z } from "zod";
import { initializeAIClient } from "../../lib/ai-client.js";
import { errorResponse, jsonOk, zodErrorHandler } from "../../lib/response.js";
import { parseDiff } from "@repo/core/diff";
import { triageReview, getLenses, getProfile } from "@repo/core/review";
import type { LensId, ProfileId } from "@repo/schemas/lens";
import type { TriageIssue, TriageSeverity } from "@repo/schemas/triage";

const prReview = new Hono();

const PRReviewRequestSchema = z.object({
  diff: z.string().min(1, "diff is required"),
  lenses: z.array(z.string()).optional(),
  profile: z.string().optional(),
  baseRef: z.string().optional(),
  headRef: z.string().optional(),
});

type PRReviewRequest = z.infer<typeof PRReviewRequestSchema>;

type AnnotationLevel = "notice" | "warning" | "failure";

interface GitHubAnnotation {
  path: string;
  start_line: number;
  end_line: number;
  annotation_level: AnnotationLevel;
  message: string;
  title: string;
}

interface InlineComment {
  path: string;
  line: number;
  side: "RIGHT";
  body: string;
}

interface PRReviewResponse {
  summary: string;
  issues: Array<{
    severity: string;
    title: string;
    file: string;
    line: number;
    message: string;
    suggestion?: string;
  }>;
  annotations: GitHubAnnotation[];
  inlineComments: InlineComment[];
}

function severityToAnnotationLevel(severity: TriageSeverity): AnnotationLevel {
  switch (severity) {
    case "blocker":
    case "high":
      return "failure";
    case "medium":
      return "warning";
    case "low":
    case "nit":
      return "notice";
  }
}

function issueToAnnotation(issue: TriageIssue): GitHubAnnotation | null {
  if (issue.line_start === null) {
    return null;
  }

  return {
    path: issue.file,
    start_line: issue.line_start,
    end_line: issue.line_end ?? issue.line_start,
    annotation_level: severityToAnnotationLevel(issue.severity),
    message: `${issue.rationale}\n\nRecommendation: ${issue.recommendation}`,
    title: `[${issue.severity.toUpperCase()}] ${issue.title}`,
  };
}

function issueToInlineComment(issue: TriageIssue): InlineComment | null {
  if (!issue.file || !issue.line_start) return null;

  const severityEmoji: Record<TriageSeverity, string> = {
    blocker: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🔵',
    nit: '⚪',
  };

  const body = [
    `${severityEmoji[issue.severity]} **${issue.severity.toUpperCase()}**: ${issue.title}`,
    '',
    issue.symptom || issue.rationale,
    '',
    issue.recommendation ? `**Suggestion:** ${issue.recommendation}` : '',
    issue.suggested_patch ? `\`\`\`suggestion\n${issue.suggested_patch}\n\`\`\`` : '',
  ].filter(Boolean).join('\n');

  return {
    path: issue.file,
    line: issue.line_start,
    side: "RIGHT",
    body,
  };
}

function issueToSimplified(issue: TriageIssue) {
  return {
    severity: issue.severity,
    title: issue.title,
    file: issue.file,
    line: issue.line_start ?? 0,
    message: issue.rationale,
    suggestion: issue.suggested_patch ?? undefined,
  };
}

prReview.post("/", async (c) => {
  const body = await c.req.json<PRReviewRequest>();
  const parseResult = PRReviewRequestSchema.safeParse(body);

  const validationError = zodErrorHandler(parseResult, c);
  if (validationError) return validationError;

  const { diff, lenses: lensesParam, profile: profileParam } = parseResult.data!;

  const clientResult = await initializeAIClient();
  if (!clientResult.ok) {
    return errorResponse(c, clientResult.error.message, clientResult.error.code, 500);
  }

  const parsed = parseDiff(diff);

  if (parsed.files.length === 0) {
    return errorResponse(c, "No parseable diff content found", "NO_DIFF", 400);
  }

  const profile = profileParam ? getProfile(profileParam as ProfileId) : undefined;
  const activeLenses = lensesParam
    ? (lensesParam as LensId[])
    : profile?.lenses ?? ["correctness"];
  const lenses = getLenses(activeLenses);

  const allIssues: TriageIssue[] = [];
  const summaries: string[] = [];

  for (const lens of lenses) {
    const result = await triageReview(clientResult.value, parsed, {
      lenses: [lens.id],
      filter: profile?.filter,
    });

    if (!result.ok) {
      return errorResponse(c, result.error.message, "AI_ERROR", 500);
    }

    allIssues.push(...result.value.issues);
    summaries.push(result.value.summary);
  }

  const annotations = allIssues
    .map(issueToAnnotation)
    .filter((a): a is GitHubAnnotation => a !== null);

  const inlineComments = allIssues
    .map(issueToInlineComment)
    .filter((c): c is InlineComment => c !== null);

  const response: PRReviewResponse = {
    summary: summaries.join("\n\n"),
    issues: allIssues.map(issueToSimplified),
    annotations,
    inlineComments,
  };

  return jsonOk(c, response);
});

export { prReview };
