import { makeIssue } from "@diffgazer/core/testing/factories";
import { describe, expect, it } from "vitest";
import { makeFileDiff, makeParsedDiff } from "../../testing/factories.js";
import type { DiffHunk } from "../diff/types.js";
import { createIssueEvidenceResolver, MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES } from "./evidence.js";

describe("createIssueEvidenceResolver", () => {
  it("replaces provider-authored code evidence with canonical diff evidence", () => {
    const issue = makeIssue({
      file: "test.ts",
      line_start: 3,
      line_end: 4,
      evidence: [
        {
          type: "code",
          title: "Provider evidence",
          sourceId: "provider",
          file: "test.ts",
          excerpt: "hallucinated snippet",
        },
      ],
    });
    const diff = makeParsedDiff([
      makeFileDiff({
        filePath: "test.ts",
        hunks: [
          {
            oldStart: 1,
            oldCount: 5,
            newStart: 1,
            newCount: 6,
            content: "@@ -1,5 +1,6 @@\n line1\n line2\n line3\n line4\n line5\n+added",
          },
        ],
      }),
    ]);

    const result = createIssueEvidenceResolver(diff)(issue);

    expect(result).not.toBe(issue);
    expect(result.evidence).toEqual([
      {
        type: "code",
        title: "Code at test.ts:3",
        sourceId: "test.ts:3-4",
        file: "test.ts",
        range: { start: 3, end: 4 },
        excerpt: "line3\nline4",
      },
    ]);
  });

  it("keeps only complete non-code provider references beside synthesized code evidence", () => {
    const issue = makeIssue({
      evidence: [
        { type: "code", title: "   ", sourceId: "blank", excerpt: "   " },
        { type: "doc", title: "   ", sourceId: "docs:blank", excerpt: "   " },
        { type: "doc", title: "Valid", sourceId: "docs:valid", excerpt: "doc excerpt" },
      ],
    });

    const result = createIssueEvidenceResolver(makeParsedDiff([]))(issue);

    expect(result.evidence).toEqual([
      {
        type: "code",
        title: `Issue in ${issue.file}`,
        sourceId: issue.file,
        file: issue.file,
        excerpt: issue.rationale,
      },
      { type: "doc", title: "Valid", sourceId: "docs:valid", excerpt: "doc excerpt" },
    ]);
  });

  it("replaces all-whitespace provider evidence with synthesized evidence", () => {
    const issue = makeIssue({
      evidence: [{ type: "code", title: "   ", sourceId: "   ", excerpt: "   " }],
    });

    const result = createIssueEvidenceResolver(makeParsedDiff([]))(issue);

    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]).toMatchObject({
      type: "code",
      title: `Issue in ${issue.file}`,
      sourceId: issue.file,
      excerpt: issue.rationale,
    });
  });

  it("creates fallback evidence when the diff cannot provide a matching hunk", () => {
    const issue = makeIssue({ file: "missing.ts", evidence: [] });
    const nullLineIssue = makeIssue({
      id: "null-line",
      file: "test.ts",
      line_start: null,
      evidence: [],
    });
    const diff = makeParsedDiff([makeFileDiff({ filePath: "test.ts" })]);

    const resolveEvidence = createIssueEvidenceResolver(diff);
    const result = resolveEvidence(issue);
    const nullLineResult = resolveEvidence(nullLineIssue);

    expect(result.evidence).toHaveLength(1);
    expect(result.evidence?.[0]?.type).toBe("code");
    expect(result.evidence?.[0]?.title).toContain("missing.ts");
    expect(result.evidence?.[0]?.excerpt).toBe(issue.rationale);
    expect(nullLineResult.evidence).toHaveLength(1);
    expect(nullLineResult.evidence?.[0]?.excerpt).toBe(nullLineIssue.rationale);
  });

  it("extracts evidence from a matching diff hunk", () => {
    const hunk: DiffHunk = {
      oldStart: 1,
      oldCount: 5,
      newStart: 1,
      newCount: 6,
      content: "@@ -1,5 +1,6 @@\n line1\n line2\n line3\n line4\n line5\n+added",
    };
    const file = makeFileDiff({ filePath: "test.ts", hunks: [hunk] });
    const issue = makeIssue({ file: "test.ts", line_start: 3, line_end: 4, evidence: [] });
    const diff = makeParsedDiff([file]);

    const result = createIssueEvidenceResolver(diff)(issue);

    expect(result.evidence).toHaveLength(1);
    expect(result.evidence?.[0]?.type).toBe("code");
    expect(result.evidence?.[0]?.range).toEqual({ start: 3, end: 4 });
  });

  it("normalizes an inverted fractional range before sampling both hunks", () => {
    const firstLine = "a".repeat(5_000);
    const secondLine = "b".repeat(5_000);
    const firstHunk: DiffHunk = {
      oldStart: 10,
      oldCount: 8,
      newStart: 10,
      newCount: 8,
      content: `@@ -10,8 +10,8 @@\n ${firstLine}\n line11\n line12\n line13\n line14\n line15\n line16\n line17`,
    };
    const secondHunk: DiffHunk = {
      oldStart: 30,
      oldCount: 4,
      newStart: 30,
      newCount: 4,
      content: `@@ -30,4 +30,4 @@\n ${secondLine}\n line31\n line32\n line33`,
    };
    const diff = makeParsedDiff([
      makeFileDiff({ filePath: "test.ts", hunks: [firstHunk, secondHunk] }),
    ]);
    const resolveEvidence = createIssueEvidenceResolver(diff);

    const result = resolveEvidence(
      makeIssue({ file: "test.ts", line_start: 33.8, line_end: 10.9, evidence: [] }),
    );

    const evidence = result.evidence?.[0];
    const excerpt = evidence?.excerpt ?? "";
    const excerptLines = excerpt.split("\n");
    expect(result).toMatchObject({ line_start: 10, line_end: 33 });
    expect(excerptLines).toHaveLength(5);
    expect(excerptLines[0]).toMatch(/^a+$/);
    expect(excerptLines.some((line) => line.startsWith("b"))).toBe(true);
    expect(excerptLines.filter((line) => line === "... [evidence gap] ...")).toHaveLength(1);
    expect(Buffer.byteLength(JSON.stringify(excerpt), "utf8")).toBeLessThanOrEqual(
      MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES,
    );
    expect(evidence?.range).toEqual({ start: 10, end: 33 });
    expect(evidence?.sourceId).toBe("test.ts:10-33");
  });
});
