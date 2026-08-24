import type { IssueTab } from "@diffgazer/core/schemas/presentation";
import { type ReviewIssue, SavedReviewSchema } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { FOCUS_OUTLINE } from "@diffgazer/ui/lib/focus-outline";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IssueDetailsPane } from "./pane";

function renderPane(
  issue: ReviewIssue | null,
  activeTab: IssueTab = "details",
  callbacks: {
    onTabChange?: (tab: IssueTab) => void;
    onTabsBoundaryReached?: (direction: "previous" | "next") => void;
  } = {},
) {
  return render(paneElement(issue, activeTab, callbacks));
}

function paneElement(
  issue: ReviewIssue | null,
  activeTab: IssueTab = "details",
  callbacks: {
    onTabChange?: (tab: IssueTab) => void;
    onTabsBoundaryReached?: (direction: "previous" | "next") => void;
  } = {},
) {
  return (
    <IssueDetailsPane
      issue={issue}
      activeTab={activeTab}
      onTabChange={callbacks.onTabChange ?? vi.fn()}
      onTabsBoundaryReached={callbacks.onTabsBoundaryReached}
      completedSteps={new Set<number>()}
      onToggleStep={vi.fn()}
    />
  );
}

const evidenceVariants: ReviewIssue["evidence"] = [
  {
    type: "code",
    title: "Unsafe parser",
    sourceId: "source:parser",
    file: "src/parser.ts",
    range: { start: 7, end: 7 },
    excerpt: "const value = JSON.parse(input);",
  },
  {
    type: "code",
    title: "Empty parser evidence",
    sourceId: "source:empty-parser",
    file: "src/empty-parser.ts",
    range: { start: 11, end: 11 },
    excerpt: "",
  },
  {
    type: "doc",
    title: "Parser contract",
    sourceId: "docs/reference/parser",
    excerpt: "Invalid input must return a typed failure.",
  },
  {
    type: "trace",
    title: "Failure reproduction",
    sourceId: "trace:parse-invalid-input",
    excerpt: "Malformed JSON throws before the error boundary runs.",
  },
  {
    type: "external",
    title: "JSON parsing guidance",
    sourceId: "javascript:alert('not-a-link')",
    excerpt: "Treat parser failures as expected input errors.",
  },
];

function makeAllEvidenceIssue(): ReviewIssue {
  return makeIssue({
    evidence: evidenceVariants,
    trace: [
      {
        step: 1,
        tool: "test-runner",
        inputSummary: "Run parser test",
        outputSummary: "Test failed",
        timestamp: "2026-07-14T08:00:00.000Z",
      },
    ],
  });
}

/**
 * Paths render through `PathValue`, which splits the value into a truncating head
 * and an always-visible tail segment, so the full string is no longer one text node.
 */
function expectPathValue(fullValue: string, tail: string) {
  const tailNode = screen.getByText(tail);
  expect(tailNode.closest("[title]")).toHaveAttribute("title", fullValue);
}

/**
 * Evidence lines are syntax-tokenized, so a row's text is spread across token
 * spans rather than sitting in one text node.
 */
function evidenceLineTexts(root: ParentNode = document): string[] {
  return [...root.querySelectorAll('[data-slot="code-block-line"] code')].map(
    (line) => line.textContent ?? "",
  );
}

function expectAllEvidenceVariants() {
  expect(screen.getByRole("region", { name: "Evidence" })).toHaveTextContent(
    "const value = JSON.parse(input);",
  );
  expect(screen.getByText("Unsafe parser")).toBeInTheDocument();
  expect(screen.getByText("source:parser")).toBeInTheDocument();
  expectPathValue("src/parser.ts", "/parser.ts");
  expect(screen.getByText("Empty parser evidence")).toBeInTheDocument();
  expect(screen.getByText("source:empty-parser")).toBeInTheDocument();
  expectPathValue("src/empty-parser.ts", "/empty-parser.ts");
  expect(
    screen.getByRole("region", { name: "Code evidence: Empty parser evidence" }),
  ).toHaveTextContent("(empty excerpt)");
  expect(screen.getByText("Unverified documentation reference")).toBeInTheDocument();
  expect(screen.getByText("Parser contract")).toBeInTheDocument();
  expect(screen.getByText("docs/reference/parser")).toBeInTheDocument();
  expect(screen.getByText("Invalid input must return a typed failure.")).toBeInTheDocument();
  expect(screen.getByText("Unverified trace reference")).toBeInTheDocument();
  expect(screen.getByText("Failure reproduction")).toBeInTheDocument();
  expect(screen.getByText("trace:parse-invalid-input")).toBeInTheDocument();
  expect(
    screen.getByText("Malformed JSON throws before the error boundary runs."),
  ).toBeInTheDocument();
  expect(screen.getByText("Unverified external reference")).toBeInTheDocument();
  expect(screen.getByText("JSON parsing guidance")).toBeInTheDocument();
  expect(screen.getByText("javascript:alert('not-a-link')")).toBeInTheDocument();
  expect(screen.getByText("Treat parser failures as expected input errors.")).toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
}

describe("IssueDetailsPane", () => {
  const malformedEvidenceRanges = [
    { start: -1, end: 2 },
    { start: 1.5, end: 2 },
    { start: 0, end: 1 },
    { start: 8, end: 4 },
  ];

  function issueWithMalformedEvidenceRanges(): ReviewIssue {
    return makeIssue({
      evidence: malformedEvidenceRanges.map((range, index) => ({
        type: "code",
        title: `Malformed evidence ${index}`,
        sourceId: `source-${index}`,
        file: "src/example.ts",
        range,
        excerpt: `retained excerpt ${index}`,
      })),
    });
  }

  function expectMalformedRangesHidden(container: HTMLElement): void {
    const excerpts = evidenceLineTexts(container);
    for (const index of malformedEvidenceRanges.keys()) {
      expect(excerpts).toContain(`retained excerpt ${index}`);
    }
    expect(container.querySelectorAll('[data-slot="code-block-line-number"]')).toHaveLength(0);
  }

  it("keeps the complete issue location available when the header truncates it", () => {
    const file = "src/features/review/components/a/very/long/location/issue-details-pane.tsx";
    renderPane(makeIssue({ file, line_start: 120, line_end: null }));

    expectPathValue(`${file}:120`, "/issue-details-pane.tsx:120");
  });

  it("keeps the evidence file name readable when the path outruns the pane", () => {
    const file = "cli/diffgazer/src/features/history/components/history-list.tsx";
    renderPane(
      makeIssue({
        evidence: [
          {
            type: "code",
            title: "Long path evidence",
            sourceId: "source:long-path",
            file,
            range: { start: 3, end: 3 },
            excerpt: "const rows = [];",
          },
        ],
      }),
    );

    expectPathValue(file, "/history-list.tsx");
  });

  it("shows both semantic input and output summaries in the trace tab", () => {
    renderPane(makeAllEvidenceIssue(), "trace");

    expect(screen.getByText("in:").parentElement).toHaveTextContent("in: Run parser test");
    expect(screen.getByText("out:").parentElement).toHaveTextContent("out: Test failed");
  });

  it("labels rationale and recommendation as semantic explain sections", () => {
    renderPane(
      makeIssue({
        rationale: "The parser trusts malformed input.",
        recommendation: "Return a typed parse failure.",
      }),
      "explain",
    );

    expect(screen.getByRole("heading", { level: 2, name: "Rationale" })).toBeInTheDocument();
    expect(screen.getByText("The parser trusts malformed input.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Recommendation" })).toBeInTheDocument();
    expect(screen.getByText("Return a typed parse failure.")).toBeInTheDocument();
  });

  it("omits malformed evidence locations from a streamed issue while retaining excerpts", () => {
    const { container } = renderPane(issueWithMalformedEvidenceRanges());

    expectMalformedRangesHidden(container);
  });

  it("maps each physical evidence row to its source line", () => {
    renderPane(
      makeIssue({
        evidence: [
          {
            type: "code",
            title: "Multiline parser evidence",
            sourceId: "source:multiline-parser",
            file: "src/parser.ts",
            range: { start: 40, end: 42 },
            excerpt: "const parsed = parse(input);\nvalidate(parsed);\nreturn parsed;",
          },
        ],
      }),
    );

    const evidence = screen.getByRole("region", {
      name: "Code evidence: Multiline parser evidence",
    });
    const rows = [...evidence.querySelectorAll('[data-slot="code-block-line"]')];

    expect(
      rows.map((row) => row.querySelector('[data-slot="code-block-line-number"]')?.textContent),
    ).toEqual(["40", "41", "42"]);
    expect(rows.map((row) => row.querySelector("code")?.textContent)).toEqual([
      "const parsed = parse(input);",
      "validate(parsed);",
      "return parsed;",
    ]);
  });

  it("renders one plain evidence row per excerpt line", () => {
    const excerpt = "const parsed = parse(input);\nvalidate(parsed);\nreturn parsed;";
    renderPane(
      makeIssue({
        evidence: [
          {
            type: "code",
            title: "Plain parser evidence",
            sourceId: "source:plain-parser",
            file: "src/parser.ts",
            range: { start: 7, end: 9 },
            excerpt,
          },
        ],
      }),
    );

    const evidence = screen.getByRole("region", { name: "Code evidence: Plain parser evidence" });
    const rows = [...evidence.querySelectorAll('[data-slot="code-block-line"]')];

    expect(rows).toHaveLength(excerpt.split(/\r?\n/).length);
    // Evidence rows stay plain: tinting every row left the code block's inset
    // untinted, so the padding read as a blank line. Per-line state is a diff signal.
    for (const row of rows) {
      expect(row).not.toHaveAttribute("data-state");
    }
    expect(
      rows.map((row) => row.querySelector('[data-slot="code-block-line-number"]')?.textContent),
    ).toEqual(["7", "8", "9"]);
  });

  it("colors evidence syntax with the shared code block token palette", () => {
    renderPane(
      makeIssue({
        evidence: [
          {
            type: "code",
            title: "Colored parser evidence",
            sourceId: "source:colored-parser",
            file: "src/parser.ts",
            range: { start: 7, end: 7 },
            excerpt: "const parsed = parse(input); // trusts the caller",
          },
        ],
      }),
    );

    const evidence = screen.getByRole("region", { name: "Code evidence: Colored parser evidence" });

    expect(evidence.querySelector(".code-keyword")).toHaveTextContent("const");
    expect(evidence.querySelector(".code-comment")).toHaveTextContent("// trusts the caller");
    expect(evidence.querySelector("code")).toHaveTextContent(
      "const parsed = parse(input); // trusts the caller",
    );
  });

  it("numbers every excerpt row, including one past the declared range end", () => {
    renderPane(
      makeIssue({
        evidence: [
          {
            type: "code",
            title: "Trailing context evidence",
            sourceId: "source:trailing-context",
            file: "src/parser.ts",
            range: { start: 40, end: 42 },
            excerpt: "line 40\nline 41\nline 42\ncontext past the range",
          },
        ],
      }),
    );

    const evidence = screen.getByRole("region", {
      name: "Code evidence: Trailing context evidence",
    });
    const rows = [...evidence.querySelectorAll('[data-slot="code-block-line"]')];

    // A row with no number renders no gutter cell, so a partly numbered block
    // would indent its remaining rows one gutter to the left.
    expect(
      rows.map((row) => row.querySelector('[data-slot="code-block-line-number"]')?.textContent),
    ).toEqual(["40", "41", "42", "43"]);
  });

  it("omits malformed evidence locations from a lenient saved issue while retaining excerpts", () => {
    const issue = issueWithMalformedEvidenceRanges();
    const saved = SavedReviewSchema.parse({
      metadata: {
        id: "11111111-1111-4111-8111-111111111111",
        projectPath: "/repo",
        createdAt: "2026-07-14T08:00:00.000Z",
        mode: "unstaged",
        branch: "main",
        profile: null,
        lenses: ["correctness"],
        issueCount: 1,
        blockerCount: 0,
        highCount: 1,
        mediumCount: 0,
        lowCount: 0,
        nitCount: 0,
        fileCount: 1,
      },
      result: { issues: [issue] },
      gitContext: {
        branch: "main",
        commit: "abc123",
        fileCount: 1,
        additions: 1,
        deletions: 0,
      },
    });

    const { container } = renderPane(saved.result.issues[0] ?? null);

    expectMalformedRangesHidden(container);
  });

  it("renders every evidence variant from a live review", () => {
    renderPane(makeAllEvidenceIssue());

    expectAllEvidenceVariants();
  });

  it("renders every evidence variant after a saved review round trip", () => {
    const issue = makeAllEvidenceIssue();
    const savedReview = SavedReviewSchema.parse(
      JSON.parse(
        JSON.stringify({
          metadata: {
            id: "11111111-1111-4111-8111-111111111111",
            projectPath: "/repo",
            createdAt: "2026-07-14T08:00:00.000Z",
            mode: "unstaged",
            branch: "main",
            profile: null,
            lenses: ["correctness"],
            issueCount: 1,
            blockerCount: 0,
            highCount: 1,
            mediumCount: 0,
            lowCount: 0,
            nitCount: 0,
            fileCount: 1,
          },
          result: {
            issues: [
              {
                ...issue,
                category: "security",
                confidence: 0.876,
                file: "src/auth.ts",
                line_start: 14,
                line_end: 18,
                fixPlan: [
                  {
                    step: 4,
                    action: "Validate the redirect target",
                    risk: "high",
                    files: ["src/auth.ts", "src/auth.test.ts"],
                  },
                ],
              },
            ],
          },
          gitContext: {
            branch: "main",
            commit: "abc123",
            fileCount: 1,
            additions: 1,
            deletions: 0,
          },
        }),
      ),
    );

    renderPane(savedReview.result.issues[0] ?? null);

    expectAllEvidenceVariants();
    expectPathValue("src/auth.ts:14-18", "/auth.ts:14-18");
    expect(screen.getByText("security")).toBeInTheDocument();
    expect(screen.getByText("88%")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /4\. Validate the redirect target/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Risk: high")).toBeInTheDocument();
    expect(screen.getByText("Files: src/auth.ts, src/auth.test.ts")).toBeInTheDocument();
  });

  it("keeps duplicate evidence rows through a rerender without React key warnings", () => {
    const duplicateCode = {
      type: "code" as const,
      title: "Duplicate code evidence",
      sourceId: "source:duplicate-code",
      file: "src/duplicate.ts",
      range: { start: 4, end: 4 },
      excerpt: "duplicateCall();",
    };
    const duplicateReference = {
      type: "doc" as const,
      title: "Duplicate reference evidence",
      sourceId: "docs/duplicate",
      excerpt: "Duplicate documentation excerpt.",
    };
    const issue = makeIssue({
      evidence: [duplicateCode, duplicateCode, duplicateReference, duplicateReference],
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const view = renderPane(issue);

      expect(evidenceLineTexts()).toEqual(["duplicateCall();", "duplicateCall();"]);
      expect(screen.getAllByText("Duplicate documentation excerpt.")).toHaveLength(2);

      view.rerender(paneElement(makeIssue({ evidence: issue.evidence })));

      expect(evidenceLineTexts()).toEqual(["duplicateCall();", "duplicateCall();"]);
      expect(screen.getAllByText("Duplicate documentation excerpt.")).toHaveLength(2);
      expect(consoleError.mock.calls.flat().map(String).join(" ")).not.toMatch(
        /same key|unique ["']key["']/i,
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("keeps duplicate tests-to-add rows through removal without React key warnings", () => {
    const duplicate = "Add the duplicate regression test";
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const view = renderPane(makeIssue({ testsToAdd: [duplicate, duplicate] }));

      expect(screen.getAllByText(duplicate)).toHaveLength(2);

      view.rerender(paneElement(makeIssue({ testsToAdd: [duplicate] })));

      expect(screen.getAllByText(duplicate)).toHaveLength(1);
      expect(consoleError.mock.calls.flat().map(String).join(" ")).not.toMatch(
        /same key|unique ["']key["']/i,
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("renders the Better Options heading with each suggested alternative", () => {
    renderPane(
      makeIssue({
        betterOptions: [
          "Use a parameterized query instead of string concatenation",
          "Validate the redirect target against an allowlist",
        ],
      }),
    );

    expect(screen.getByRole("heading", { name: "BETTER OPTIONS" })).toBeInTheDocument();
    expect(
      screen.getByText("Use a parameterized query instead of string concatenation"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Validate the redirect target against an allowlist"),
    ).toBeInTheDocument();
  });

  it("exposes the issue severity textually in the details heading, not only by color", () => {
    renderPane(makeIssue({ severity: "blocker", title: "Null deref crashes startup" }));

    // The colored h1 alone leaves severity inaccessible; the heading now
    // carries the severity word for screen readers.
    expect(
      screen.getByRole("heading", { name: /blocker severity.*null deref crashes startup/i }),
    ).toBeInTheDocument();
  });

  it("shows an empty details state until an issue is selected", () => {
    renderPane(null);

    expect(screen.getByText("Select an issue to view details")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Details" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Patch" })).not.toBeInTheDocument();
  });

  it("tags the pane frame even when no issue is selected", () => {
    renderPane(null);

    expect(screen.getByText("Details")).toBeInTheDocument();
  });

  it("does not fabricate a line number when issue location has no line", () => {
    renderPane(makeIssue({ file: "src/db.ts", line_start: null, line_end: null }));

    expectPathValue("src/db.ts:?", "/db.ts:?");
    expect(screen.queryByText("/db.ts:0")).not.toBeInTheDocument();
  });

  it("keeps multi-file suggested patches visible instead of dropping later files", () => {
    renderPane(
      makeIssue({
        suggested_patch: [
          "diff --git a/src/a.ts b/src/a.ts",
          "--- a/src/a.ts",
          "+++ b/src/a.ts",
          "@@ -1 +1 @@",
          "-oldA",
          "+newA",
          "diff --git a/src/b.ts b/src/b.ts",
          "--- a/src/b.ts",
          "+++ b/src/b.ts",
          "@@ -1 +1 @@",
          "-oldB",
          "+newB",
        ].join("\n"),
      }),
      "patch",
    );

    expect(screen.queryByText("No changes")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Suggested patch" })).toHaveTextContent("newB");
  });

  it("keeps loose hunk snippets visible when they are not parseable unified diffs", () => {
    renderPane(
      makeIssue({
        suggested_patch: [
          "--- a/src/example.ts",
          "+++ b/src/example.ts",
          "@@",
          "-const value = 1;",
          "+const value = 2;",
        ].join("\n"),
      }),
      "patch",
    );

    expect(screen.queryByText("No changes")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Suggested patch" })).toHaveTextContent(
      "const value = 2",
    );
  });

  it("renders a plain replacement snippet as a diff when target metadata and retained text match", () => {
    renderPane(
      makeIssue({
        file: "src/example.ts",
        suggested_patch: ["const value = safeParse(input);", "return value;"].join("\n"),
        evidence: [
          {
            type: "code",
            title: "Unsafe parse",
            sourceId: "src/example.ts",
            file: "src/example.ts",
            excerpt: ["const value = JSON.parse(input);", "return value;"].join("\n"),
          },
        ],
      }),
      "patch",
    );

    const diff = screen.getByRole("figure", { name: "Suggested patch" });
    expect(diff).toHaveTextContent("const value = JSON.parse(input);");
    expect(diff).toHaveTextContent("const value = safeParse(input);");
    expect(screen.getByText("Removed:")).toBeInTheDocument();
    expect(screen.getByText("Added:")).toBeInTheDocument();
  });

  it("keeps a lone unrelated code excerpt out of a plain replacement diff", () => {
    renderPane(
      makeIssue({
        file: "src/example.ts",
        suggested_patch: "const value = safeParse(input);",
        evidence: [
          {
            type: "code",
            title: "Unrelated cache evidence",
            sourceId: "src/example.ts:cache",
            file: "src/example.ts",
            excerpt: "const cachedValue = readCache();",
          },
        ],
      }),
      "patch",
    );

    const patchRegion = screen.getByRole("region", { name: "Suggested patch" });
    expect(patchRegion).toHaveTextContent("const value = safeParse(input);");
    expect(
      within(patchRegion).queryByText("const cachedValue = readCache();"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Removed:")).not.toBeInTheDocument();
  });

  it("requires exact target-file metadata even when an evidence line overlaps", () => {
    renderPane(
      makeIssue({
        file: "src/target.ts",
        suggested_patch: ["const value = safeParse(input);", "return value;"].join("\n"),
        evidence: [
          {
            type: "code",
            title: "Other file",
            sourceId: "src/other.ts",
            file: "src/other.ts",
            excerpt: ["const value = JSON.parse(input);", "return value;"].join("\n"),
          },
        ],
      }),
      "patch",
    );

    expect(screen.getByRole("region", { name: "Suggested patch" })).toHaveTextContent(
      "const value = safeParse(input);",
    );
    expect(screen.queryByText("Removed:")).not.toBeInTheDocument();
  });

  it("keeps a plain snippet as a code block when the issue has no code evidence", () => {
    renderPane(makeIssue({ suggested_patch: "const value = safeParse(input);" }), "patch");

    expect(screen.getByRole("region", { name: "Suggested patch" })).toHaveTextContent(
      "const value = safeParse(input);",
    );
  });

  it("does not diff a plain snippet against unrelated evidence when multiple code excerpts exist", () => {
    renderPane(
      makeIssue({
        suggested_patch: "const value = safeParse(input);",
        evidence: [
          {
            type: "code",
            title: "Unrelated first excerpt",
            sourceId: "src/unrelated.ts",
            excerpt: "const cachedValue = readCache();",
          },
          {
            type: "code",
            title: "Unrelated second excerpt",
            sourceId: "src/other.ts",
            excerpt: "return fallbackValue;",
          },
        ],
      }),
      "patch",
    );

    const patchRegion = screen.getByRole("region", { name: "Suggested patch" });
    expect(patchRegion).toHaveTextContent("const value = safeParse(input);");
    expect(
      within(patchRegion).queryByText("const cachedValue = readCache();"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Removed:")).not.toBeInTheDocument();
  });
});

describe("IssueDetailsPane tab-strip navigation", () => {
  it("reports a previous-boundary instead of looping when ArrowLeft is pressed on the first tab", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    const onTabsBoundaryReached = vi.fn();
    renderPane(makeIssue(), "details", { onTabChange, onTabsBoundaryReached });

    await user.click(screen.getByRole("tab", { name: "Details" }));
    await user.keyboard("{ArrowLeft}");

    expect(onTabsBoundaryReached).toHaveBeenCalledWith("previous");
    expect(onTabChange).not.toHaveBeenCalledWith("explain");
  });

  it("reports a next-boundary instead of looping when ArrowRight is pressed on the last tab", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    const onTabsBoundaryReached = vi.fn();
    renderPane(makeIssue({ suggested_patch: "patch" }), "patch", {
      onTabChange,
      onTabsBoundaryReached,
    });

    await user.click(screen.getByRole("tab", { name: "Patch" }));
    await user.keyboard("{ArrowRight}");

    expect(onTabsBoundaryReached).toHaveBeenCalledWith("next");
    expect(onTabChange).not.toHaveBeenCalledWith("details");
  });
});

describe("IssueDetailsPane chrome", () => {
  it("rests until focus enters the pane, then wears the focused chrome", async () => {
    const user = userEvent.setup();
    renderPane(makeIssue());
    const pane = screen.getByRole("complementary", { name: "Issue details" });

    expect(pane).not.toHaveAttribute("data-state", "focused");

    await user.click(screen.getByRole("tab", { name: "Details" }));

    expect(pane).toHaveAttribute("data-state", "focused");
  });

  it("returns to resting chrome once focus leaves the pane", async () => {
    const user = userEvent.setup();
    render(
      <>
        {paneElement(makeIssue())}
        <button type="button">outside</button>
      </>,
    );
    const pane = screen.getByRole("complementary", { name: "Issue details" });

    await user.click(screen.getByRole("tab", { name: "Details" }));
    expect(pane).toHaveAttribute("data-state", "focused");

    await user.click(screen.getByRole("button", { name: "outside" }));

    expect(pane).not.toHaveAttribute("data-state", "focused");
  });
});

describe("IssueDetailsPane tab stops", () => {
  it("keeps the tab panel and evidence section out of the tab order so Tab stays a pane switcher", () => {
    renderPane(
      makeIssue({
        evidence: [
          {
            type: "code",
            title: "Evidence",
            sourceId: "src/example.ts",
            excerpt: "const a = 1;",
          },
        ],
      }),
    );

    expect(screen.getByRole("tabpanel")).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("region", { name: "Evidence" })).toHaveAttribute("tabindex", "-1");
  });

  it("puts the evidence excerpt in the tab order, since it still scrolls sideways", () => {
    renderPane(
      makeIssue({
        evidence: [
          {
            type: "code",
            title: "Evidence",
            sourceId: "src/example.ts",
            excerpt: "const a = 1;",
          },
        ],
      }),
    );

    expect(screen.getByRole("region", { name: "Code evidence: Evidence" })).toHaveAttribute(
      "tabindex",
      "0",
    );
  });

  it("wraps the plain-snippet patch block and keeps it reachable", () => {
    renderPane(makeIssue({ suggested_patch: "const value = safeParse(input);" }), "patch");

    const patch = screen.getByRole("region", { name: "Suggested patch" });
    expect(patch).toHaveAttribute("tabindex", "0");
    expect(patch.querySelector('[data-slot="code-block-content"]')).toHaveAttribute(
      "data-wrap",
      "on",
    );
  });

  it("syntax-colors the plain-snippet patch from the issue file's language", () => {
    renderPane(
      makeIssue({
        file: "src/example.tsx",
        suggested_patch: "const value = safeParse(input);",
      }),
      "patch",
    );

    const patch = screen.getByRole("region", { name: "Suggested patch" });
    expect(within(patch).getByText("const")).toHaveClass("code-keyword");
    expect(patch.querySelector('[data-slot="code-block-content"]')).toHaveAttribute(
      "data-wrap",
      "on",
    );
    expect(patch).toHaveAttribute("tabindex", "0");
  });

  it("keeps a plain-snippet patch uncolored when no grammar claims the issue file", () => {
    renderPane(
      makeIssue({
        file: "docs/notes.txt",
        suggested_patch: "const value = safeParse(input);",
      }),
      "patch",
    );

    const patch = screen.getByRole("region", { name: "Suggested patch" });
    expect(within(patch).queryByText("const")).not.toBeInTheDocument();
    expect(patch).toHaveTextContent("const value = safeParse(input);");
  });
});

describe("mobile back to issues", () => {
  it("renders nothing without onBackToList", () => {
    renderPane(makeIssue());

    expect(screen.queryByRole("button", { name: "Issues" })).not.toBeInTheDocument();
  });

  it("hands the tap back to the list through a Button wearing the shared focus grammar", async () => {
    const user = userEvent.setup();
    const onBackToList = vi.fn();
    render(
      <IssueDetailsPane
        issue={makeIssue()}
        activeTab="details"
        onTabChange={vi.fn()}
        completedSteps={new Set<number>()}
        onToggleStep={vi.fn()}
        onBackToList={onBackToList}
      />,
    );

    const back = screen.getByRole("button", { name: "Issues" });
    // The grammar is libs/ui's documented class contract, imported from the
    // package: a revert to a bespoke <button> without the shared focus mark
    // fails here.
    expect(back).toHaveClass(...FOCUS_OUTLINE.split(" "));

    await user.click(back);

    expect(onBackToList).toHaveBeenCalledTimes(1);
  });
});
