import { ok } from "@diffgazer/core/result";
import {
  LENS_IDS,
  LensReviewResultSchema,
  MAX_REVIEW_ISSUES,
  MAX_REVIEW_ISSUES_PER_LENS,
  type ReviewIssue,
  ReviewResultSchema,
} from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { describe, expect, it } from "vitest";
import { createGitService } from "../../../../shared/lib/git/service.js";
import { makeParsedDiff } from "../../../../shared/lib/testing/factories.js";
import { MAX_DIFF_SIZE_BYTES, resolveGitDiff } from "../../diff.js";
import { lenientReadSavedReview } from "../../storage/lenient-read.js";
import {
  createIssueEvidenceResolver,
  MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES,
  MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES_PER_REVIEW,
  MAX_SYNTHESIZED_EVIDENCE_LINES,
} from "./evidence.js";

type GitService = ReturnType<typeof createGitService>;

function makeGitService(getDiff: GitService["getDiff"]): GitService {
  return { getDiff } as GitService;
}

function makeNearLimitSingleLineDiff(): string {
  const prefix = [
    "diff --git a/src/large.ts b/src/large.ts",
    "index 1111111..2222222 100644",
    "--- a/src/large.ts",
    "+++ b/src/large.ts",
    "@@ -1 +1 @@",
    "-old",
    "+",
  ].join("\n");
  const suffix = "\n";
  const lineBytes =
    MAX_DIFF_SIZE_BYTES - Buffer.byteLength(prefix, "utf8") - Buffer.byteLength(suffix, "utf8");
  return `${prefix}${"\\".repeat(lineBytes)}${suffix}`;
}

function serializedEvidenceExcerptBytes(issues: ReviewIssue[]): number {
  const evidence = issues.map((issue) => issue.evidence);
  const withoutExcerpts = evidence.map((refs) =>
    refs.map((reference) => ({ ...reference, excerpt: "" })),
  );
  return (
    Buffer.byteLength(JSON.stringify(evidence, null, 2), "utf8") -
    Buffer.byteLength(JSON.stringify(withoutExcerpts, null, 2), "utf8")
  );
}

describe("synthesized issue evidence envelope", () => {
  it("caps one lens and the closed five-lens final result without dropping aggregate findings", () => {
    const issue = makeIssue();
    const lensIssues = Array.from({ length: MAX_REVIEW_ISSUES_PER_LENS }, () => issue);
    const finalIssues = Array.from({ length: MAX_REVIEW_ISSUES }, () => issue);

    expect(MAX_REVIEW_ISSUES).toBe(LENS_IDS.length * MAX_REVIEW_ISSUES_PER_LENS);
    expect(LensReviewResultSchema.safeParse({ issues: lensIssues }).success).toBe(true);
    expect(LensReviewResultSchema.safeParse({ issues: [...lensIssues, issue] }).success).toBe(
      false,
    );
    expect(ReviewResultSchema.safeParse({ issues: finalIssues }).success).toBe(true);
    expect(ReviewResultSchema.safeParse({ issues: [...finalIssues, issue] }).success).toBe(false);

    const oversizedStoredIssues = [...finalIssues, issue];
    const legacyReview = lenientReadSavedReview({
      metadata: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        projectPath: "/repo",
        createdAt: "2026-01-01T00:00:00.000Z",
        mode: "unstaged",
        branch: "main",
        profile: null,
        lenses: ["correctness"],
        issueCount: oversizedStoredIssues.length,
        fileCount: 1,
      },
      result: { summary: "legacy", issues: oversizedStoredIssues },
      gitContext: {
        branch: "main",
        commit: null,
        fileCount: 1,
        additions: 0,
        deletions: 0,
      },
    });
    expect(legacyReview?.item.result.issues).toHaveLength(oversizedStoredIssues.length);
    expect(legacyReview?.item.result).not.toHaveProperty("summary");
  });

  it("bounds a near-limit physical line once for 256 evidence-empty issues", async () => {
    const rawDiff = makeNearLimitSingleLineDiff();
    const diffResult = await resolveGitDiff({
      gitService: makeGitService(async () => ok(rawDiff)),
      mode: "unstaged",
      emit: async () => undefined,
      reviewId: "review-envelope",
    });

    expect(diffResult.ok).toBe(true);
    if (!diffResult.ok) return;
    expect(diffResult.value.totalStats.totalSizeBytes).toBe(MAX_DIFF_SIZE_BYTES);

    const hunk = diffResult.value.files[0]?.hunks[0];
    expect(hunk).toBeDefined();
    if (!hunk) return;
    const hunkContent = hunk.content;
    let hunkContentReads = 0;
    Object.defineProperty(hunk, "content", {
      configurable: true,
      enumerable: true,
      get: () => {
        hunkContentReads++;
        return hunkContent;
      },
    });

    const resolveEvidence = createIssueEvidenceResolver(diffResult.value);
    const issues = LensReviewResultSchema.parse({
      issues: Array.from({ length: MAX_REVIEW_ISSUES_PER_LENS }, (_, index) =>
        makeIssue({
          id: `issue-${index}`,
          file: "src/large.ts",
          line_start: 1,
          line_end: 1,
          evidence: [],
        }),
      ),
    }).issues;
    const processed = issues.map(resolveEvidence);

    const perIssueBytes = Math.max(
      ...processed.map((issue) => serializedEvidenceExcerptBytes([issue])),
    );
    const perLensBytes = serializedEvidenceExcerptBytes(processed);
    const perLensEnvelope = MAX_REVIEW_ISSUES_PER_LENS * MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES;

    expect(hunkContentReads).toBe(1);
    expect(perIssueBytes).toBeLessThanOrEqual(MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES);
    expect(perLensBytes).toBeLessThanOrEqual(perLensEnvelope);
    expect(MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES_PER_REVIEW).toBe(LENS_IDS.length * perLensEnvelope);
    expect(processed[0]?.evidence[0]).toMatchObject({
      range: { start: 1, end: 1 },
    });
    expect(processed[0]?.evidence[0]?.excerpt.startsWith("\\")).toBe(true);
    expect(processed[0]?.evidence[0]?.excerpt).toMatch(/\[evidence truncated\]$/);
  }, 30_000);

  it("caps source lines while retaining the full evidence range", async () => {
    const rawDiff = [
      "diff --git a/src/many-lines.ts b/src/many-lines.ts",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/src/many-lines.ts",
      "@@ -0,0 +1,6 @@",
      ...Array.from({ length: 6 }, (_, index) => `+line-${index + 1}`),
      "",
    ].join("\n");
    const diffResult = await resolveGitDiff({
      gitService: makeGitService(async () => ok(rawDiff)),
      mode: "unstaged",
      emit: async () => undefined,
      reviewId: "review-lines",
    });

    expect(diffResult.ok).toBe(true);
    if (!diffResult.ok) return;
    const issue = makeIssue({
      file: "src/many-lines.ts",
      line_start: 1,
      line_end: 6,
      evidence: [],
    });
    const result = createIssueEvidenceResolver(diffResult.value)(issue);
    const evidence = result.evidence[0];

    expect(evidence?.range).toEqual({ start: 1, end: 6 });
    expect(evidence?.excerpt.split("\n")).toHaveLength(MAX_SYNTHESIZED_EVIDENCE_LINES);
    expect(evidence?.excerpt).toMatch(/\[evidence truncated\]$/);
    expect(serializedEvidenceExcerptBytes([result])).toBeLessThanOrEqual(
      MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES,
    );
  });

  it("caps fallback rationale by line count and JSON byte size", () => {
    const rationale = Array.from({ length: 8 }, (_, index) => `rationale-${index + 1}`).join("\n");
    const issue = makeIssue({ file: "missing.ts", line_start: null, evidence: [], rationale });
    const result = createIssueEvidenceResolver(makeParsedDiff([]))(issue);
    const excerpt = result.evidence[0]?.excerpt;

    expect(excerpt).toBeDefined();
    if (excerpt === undefined) return;
    expect(excerpt.split("\n")).toHaveLength(MAX_SYNTHESIZED_EVIDENCE_LINES);
    expect(excerpt).toMatch(/\[evidence truncated\]$/);
    expect(Buffer.byteLength(JSON.stringify(excerpt), "utf8")).toBeLessThanOrEqual(
      MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES,
    );
  });

  it("leaves provider-supplied evidence unchanged", () => {
    const excerpt = Array.from({ length: 8 }, (_, index) => `provider-${index + 1}`).join("\n");
    const issue = makeIssue({
      evidence: [
        {
          type: "code",
          title: "Provider evidence",
          sourceId: "provider",
          file: "src/provider.ts",
          excerpt,
        },
      ],
    });

    const result = createIssueEvidenceResolver(makeParsedDiff([]))(issue);

    expect(result).toBe(issue);
    expect(result.evidence[0]?.excerpt).toBe(excerpt);
    expect(result.evidence[0]?.excerpt.split("\n")).toHaveLength(8);
  });
});
