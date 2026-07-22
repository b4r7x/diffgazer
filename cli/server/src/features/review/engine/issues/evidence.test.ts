import { describe, expect, it } from "vitest";
import { makeFileDiff, makeIssue, makeParsedDiff } from "../../../../shared/lib/testing/factories.js";
import type { DiffHunk } from "../diff/types.js";
import {
  createIssueEvidenceResolver,
  ensureIssueEvidence,
  MAX_SYNTHESIZED_EVIDENCE_JSON_BYTES,
} from "./evidence.js";

describe("ensureIssueEvidence", () => {
  it("returns issue unchanged when evidence already exists", () => {
    const issue = makeIssue({
      evidence: [
        { type: "code", title: "existing", sourceId: "s1", file: "test.ts", excerpt: "code" },
      ],
    });
    const diff = makeParsedDiff([]);

    const result = ensureIssueEvidence(issue, diff);

    expect(result).toBe(issue);
  });

  it("keeps only complete references from mixed provider evidence", () => {
    const issue = makeIssue({
      evidence: [
        { type: "code", title: "   ", sourceId: "blank", excerpt: "   " },
        { type: "code", title: "Valid", sourceId: "source", excerpt: "code" },
      ],
    });

    const result = ensureIssueEvidence(issue, makeParsedDiff([]));

    expect(result.evidence).toEqual([
      { type: "code", title: "Valid", sourceId: "source", excerpt: "code" },
    ]);
  });

  it("replaces all-whitespace provider evidence with synthesized evidence", () => {
    const issue = makeIssue({
      evidence: [{ type: "code", title: "   ", sourceId: "   ", excerpt: "   " }],
    });

    const result = ensureIssueEvidence(issue, makeParsedDiff([]));

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

    const result = ensureIssueEvidence(issue, diff);
    const nullLineResult = ensureIssueEvidence(nullLineIssue, diff);

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

    const result = ensureIssueEvidence(issue, diff);

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
