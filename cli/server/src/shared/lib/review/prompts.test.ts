import { describe, it, expect } from "vitest";
import type { Lens } from "@diffgazer/core/schemas/review";
import type { ParsedDiff, FileDiff } from "../diff/types.js";
import {
  buildDrilldownPrompt,
  buildReviewPrompt,
  CORRECTNESS_SYSTEM_PROMPT,
  DEFAULT_RUBRIC,
  SECURITY_HARDENING_PROMPT,
} from "./prompts.js";
import { makeIssue } from "../testing/factories.js";

function makeDiff(overrides: Partial<FileDiff> = {}): ParsedDiff {
  const file: FileDiff = {
    filePath: "test.ts",
    previousPath: null,
    operation: "modify",
    hunks: [],
    rawDiff: "diff content",
    stats: { additions: 1, deletions: 0, sizeBytes: 100 },
    ...overrides,
  };
  return {
    files: [file],
    totalStats: { filesChanged: 1, additions: 1, deletions: 0, totalSizeBytes: 100 },
  };
}

function makeLens(overrides: Partial<Lens> = {}): Lens {
  return {
    id: "correctness",
    name: "Correctness",
    systemPrompt: CORRECTNESS_SYSTEM_PROMPT,
    severityRubric: DEFAULT_RUBRIC,
    ...overrides,
  } as Lens;
}

describe("buildReviewPrompt", () => {
  it.each([
    {
      name: "file path attributes",
      diff: makeDiff({ filePath: "file<script>.ts" }),
      expected: 'file="file&lt;script&gt;.ts"',
      raw: 'file="file<script>.ts"',
    },
    {
      name: "diff content",
      diff: makeDiff({ rawDiff: "<div>&test</div>" }),
      expected: "&lt;div&gt;&amp;test&lt;/div&gt;",
      raw: "<div>&test</div>",
    },
    {
      name: "already escaped diff content",
      diff: makeDiff({ rawDiff: "&amp; &lt; &gt;" }),
      expected: "&amp;amp; &amp;lt; &amp;gt;",
      raw: "&amp; &lt; &gt;",
    },
    {
      name: "project context",
      diff: makeDiff(),
      projectContext: "Use <xml> & docs",
      expected: "Use &lt;xml&gt; &amp; docs",
      raw: "Use <xml> & docs",
    },
  ])("escapes $name", ({ diff, projectContext, expected, raw }) => {
    const prompt = buildReviewPrompt(makeLens(), diff, projectContext);

    expect(prompt).toContain(expected);
    expect(prompt).not.toContain(raw);
  });

  it("includes the required review prompt sections", () => {
    const prompt = buildReviewPrompt(
      makeLens({ name: "Security" }),
      makeDiff({ filePath: "src/main.ts", rawDiff: "+added line" }),
    );

    for (const section of [
      CORRECTNESS_SYSTEM_PROMPT,
      SECURITY_HARDENING_PROMPT,
      "<severity-rubric>",
      "</severity-rubric>",
      "<files-changed>",
      "</files-changed>",
      '<code-diff file="src/main.ts">',
      "</code-diff>",
      '"Security" lens',
      'Respond with JSON: { "summary": "...", "issues": [...] }',
    ]) {
      expect(prompt).toContain(section);
    }
    expect(prompt).toContain(DEFAULT_RUBRIC.blocker);
    expect(prompt).toContain(DEFAULT_RUBRIC.nit);
  });

  it.each([
    { label: "undefined", context: undefined },
    { label: "blank", context: "   " },
    { label: "default empty message", context: "No workspace packages detected." },
  ])("omits project context for $label context", ({ context }) => {
    const prompt = buildReviewPrompt(makeLens(), makeDiff(), context);

    expect(prompt).not.toContain("<project-context>");
  });

  it("lists every changed file", () => {
    const prompt = buildReviewPrompt(makeLens(), {
      files: [
        {
          filePath: "a.ts",
          previousPath: null,
          operation: "modify",
          hunks: [],
          rawDiff: "+line",
          stats: { additions: 1, deletions: 0, sizeBytes: 10 },
        },
        {
          filePath: "b.ts",
          previousPath: null,
          operation: "add",
          hunks: [],
          rawDiff: "+new",
          stats: { additions: 1, deletions: 0, sizeBytes: 10 },
        },
      ],
      totalStats: { filesChanged: 2, additions: 2, deletions: 0, totalSizeBytes: 20 },
    });

    expect(prompt).toContain("a.ts");
    expect(prompt).toContain("b.ts");
  });
});

describe("buildDrilldownPrompt", () => {
  it("escapes dynamic issue, diff, and related issue fields", () => {
    const issue = makeIssue({
      id: "id<inject>",
      title: "Title <script>alert(1)</script>",
      file: "file<evil>.ts",
      rationale: "Check <script> & injection",
      recommendation: "Use <safe> branch",
    });
    const otherIssue = makeIssue({
      id: "other<id>",
      title: "Other <title>",
      file: "other<file>.ts",
      line_start: 1,
    });
    const prompt = buildDrilldownPrompt(
      issue,
      makeDiff({ filePath: "file<evil>.ts", rawDiff: "<div>&test</div>" }),
      [issue, otherIssue],
    );

    for (const expected of [
      "ID: id&lt;inject&gt;",
      "Title: Title &lt;script&gt;alert(1)&lt;/script&gt;",
      "File: file&lt;evil&gt;.ts",
      "Check &lt;script&gt; &amp; injection",
      "Use &lt;safe&gt; branch",
      "&lt;div&gt;&amp;test&lt;/div&gt;",
      "other&lt;id&gt;",
      "Other &lt;title&gt;",
      "other&lt;file&gt;.ts",
    ]) {
      expect(prompt).toContain(expected);
    }
    expect(prompt).not.toContain("ID: id<inject>");
    expect(prompt).not.toContain("Title: Title <script>");
    expect(prompt).not.toContain("<div>&test</div>");
  });

  it("includes the required drilldown prompt sections", () => {
    const prompt = buildDrilldownPrompt(makeIssue({ file: "test.ts" }), makeDiff(), [makeIssue({ file: "test.ts" })]);

    for (const section of [
      SECURITY_HARDENING_PROMPT,
      "<issue>",
      "</issue>",
      '<code-diff file="test.ts">',
      "</code-diff>",
      "<other-issues>",
      "</other-issues>",
      "No other issues identified",
      "Respond with JSON matching this schema.",
    ]) {
      expect(prompt).toContain(section);
    }
  });
});
