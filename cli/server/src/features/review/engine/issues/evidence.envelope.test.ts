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
import type { createGitService } from "../../../../shared/lib/git/service.js";
import { resolveGitDiff } from "../../diff.js";
import { lenientReadSavedReview } from "../../storage/lenient-read.js";
import { makeParsedDiff } from "../../testing/factories.js";
import {
  createIssueEvidenceResolver,
  MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES,
  MAX_SYNTHESIZED_EVIDENCE_LINES,
} from "./evidence.js";

type GitService = ReturnType<typeof createGitService>;

function makeGitService(getDiff: GitService["getDiff"]): GitService {
  return { getDiff } as GitService;
}

/**
 * One physical diff line big enough to prove the evidence reader bounds it. Half
 * a megabyte, sized here rather than borrowed from a production ceiling so the
 * envelope test keeps testing the reader and not whatever the size gates settle on.
 */
const HUGE_SINGLE_LINE_DIFF_BYTES = 512 * 1024;

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
    HUGE_SINGLE_LINE_DIFF_BYTES -
    Buffer.byteLength(prefix, "utf8") -
    Buffer.byteLength(suffix, "utf8");
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
  it("caps one lens and the closed-lens final result without dropping aggregate findings", () => {
    const issue = makeIssue();
    const lensIssues = Array.from({ length: MAX_REVIEW_ISSUES_PER_LENS }, () => issue);
    const finalIssues = Array.from({ length: MAX_REVIEW_ISSUES }, () => issue);

    expect(LENS_IDS).toHaveLength(6);
    expect(MAX_REVIEW_ISSUES_PER_LENS).toBe(256);
    expect(MAX_REVIEW_ISSUES).toBe(1536);
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
    expect(diffResult.value.totalStats.totalSizeBytes).toBe(HUGE_SINGLE_LINE_DIFF_BYTES);

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
    expect(perLensBytes * LENS_IDS.length).toBeLessThanOrEqual(
      MAX_REVIEW_ISSUES * MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES,
    );
    expect(processed[0]?.evidence[0]).toMatchObject({
      range: { start: 1, end: 1 },
    });
    expect(processed[0]?.evidence[0]?.excerpt.startsWith("\\")).toBe(true);
    expect(processed[0]?.evidence[0]?.excerpt).toMatch(/\[evidence truncated\]$/);
  }, 30_000);

  it("caps source lines while reporting the range the excerpt still spans", async () => {
    const sourceLineCount = MAX_SYNTHESIZED_EVIDENCE_LINES * 2;
    const rawDiff = [
      "diff --git a/src/many-lines.ts b/src/many-lines.ts",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/src/many-lines.ts",
      `@@ -0,0 +1,${sourceLineCount} @@`,
      ...Array.from({ length: sourceLineCount }, (_, index) => `+line-${index + 1}`),
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
      line_end: sourceLineCount,
      evidence: [],
    });
    const result = createIssueEvidenceResolver(diffResult.value)(issue);
    const evidence = result.evidence[0];
    const excerptLines = evidence?.excerpt.split("\n") ?? [];

    expect(excerptLines).toHaveLength(MAX_SYNTHESIZED_EVIDENCE_LINES);
    expect(excerptLines[0]).toBe("line-1");
    expect(excerptLines.at(-1)).toBe(`line-${sourceLineCount}`);
    expect(evidence?.range).toEqual({ start: 1, end: sourceLineCount });
    expect(evidence?.excerptLineNumbers).toHaveLength(excerptLines.length);
    expect(evidence?.excerptLineNumbers?.at(-1)).toBe(sourceLineCount);
    expect(serializedEvidenceExcerptBytes([result])).toBeLessThanOrEqual(
      MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES,
    );
  });

  it("keeps the gutter aligned when the byte cap cuts leading rows down to indentation", () => {
    const sourceLineCount = MAX_SYNTHESIZED_EVIDENCE_LINES;
    // The first two rows are indented past the per-row byte share, so the cap
    // leaves nothing but their indentation and the stored excerpt opens on
    // line 3. Numbering the excerpt from the rows it was rendered from would
    // hand the pane 32 numbers for 30 printed rows.
    const body = (index: number) =>
      `${index < 2 ? "\t".repeat(80) : ""}const value${index + 1} = ${"x".repeat(300)};`;
    const diff = makeParsedDiff([
      {
        filePath: "src/indented.ts",
        hunks: [
          {
            oldStart: 0,
            oldCount: 0,
            newStart: 1,
            newCount: sourceLineCount,
            content: [
              `@@ -0,0 +1,${sourceLineCount} @@`,
              ...Array.from({ length: sourceLineCount }, (_, index) => `+${body(index)}`),
            ].join("\n"),
          },
        ],
      },
    ]);
    const issue = makeIssue({
      file: "src/indented.ts",
      line_start: 1,
      line_end: sourceLineCount,
      evidence: [],
    });

    const resolved = createIssueEvidenceResolver(diff)(issue);
    const stored = ReviewResultSchema.parse({ issues: [resolved] }).issues[0]?.evidence[0];
    const excerptRows = stored?.excerpt.split("\n") ?? [];

    expect(excerptRows).toHaveLength(sourceLineCount - 2);
    expect(stored?.excerptLineNumbers).toHaveLength(excerptRows.length);
    expect(stored?.excerptLineNumbers?.[0]).toBe(3);
    expect(stored?.excerptLineNumbers?.at(-1)).toBe(sourceLineCount);
    expect(stored?.range).toEqual({ start: 3, end: sourceLineCount });
    expect(stored?.title).toBe("Code at src/indented.ts:3");
    expect(serializedEvidenceExcerptBytes([resolved])).toBeLessThanOrEqual(
      MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES,
    );
  });

  it("caps fallback rationale by line count and JSON byte size", () => {
    const rationale = Array.from(
      { length: MAX_SYNTHESIZED_EVIDENCE_LINES + 3 },
      (_, index) => `rationale-${index + 1}`,
    ).join("\n");
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

  it("loads a run saved before evidence carried per-row line numbers", () => {
    const legacyEvidence = {
      type: "code" as const,
      title: "Code at src/legacy.ts:12",
      sourceId: "src/legacy.ts:12-13",
      file: "src/legacy.ts",
      range: { start: 12, end: 13 },
      excerpt: "const parsed = parse(input);\nvalidate(parsed);",
    };
    const legacyReview = lenientReadSavedReview({
      metadata: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        projectPath: "/repo",
        createdAt: "2026-01-01T00:00:00.000Z",
        mode: "unstaged",
        branch: "main",
        profile: null,
        lenses: ["correctness"],
        issueCount: 1,
        fileCount: 1,
      },
      result: {
        issues: [makeIssue({ file: "src/legacy.ts", evidence: [legacyEvidence] })],
      },
      gitContext: { branch: "main", commit: null, fileCount: 1, additions: 0, deletions: 0 },
    });

    // The field is additive: an old record keeps its excerpt and range, and no
    // numbering is invented for it on the way in.
    expect(legacyReview?.item.result.issues[0]?.evidence).toEqual([legacyEvidence]);
  });

  it("keeps unverified references while replacing provider-authored code snippets", () => {
    const issue = makeIssue({
      evidence: [
        {
          type: "code",
          title: "Provider evidence",
          sourceId: "provider",
          file: "src/provider.ts",
          excerpt: Array.from({ length: 8 }, (_, index) => `provider-${index + 1}`).join("\n"),
        },
        {
          type: "external",
          title: "Provider citation",
          sourceId: "https://example.com/reference",
          excerpt: "Provider-authored citation",
        },
      ],
    });

    const result = createIssueEvidenceResolver(makeParsedDiff([]))(issue);

    expect(result).not.toBe(issue);
    expect(result.evidence[0]).toMatchObject({
      type: "code",
      title: `Issue in ${issue.file}`,
      sourceId: issue.file,
      file: issue.file,
      excerpt: issue.rationale,
    });
    expect(result.evidence[1]).toEqual({
      type: "external",
      title: "Provider citation",
      sourceId: "https://example.com/reference",
      excerpt: "Provider-authored citation",
    });
  });
});
