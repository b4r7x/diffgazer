import type { IssueTab } from "@diffgazer/core/schemas/presentation";
import { type ReviewIssue, SavedReviewSchema } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { KeyboardProvider, useScope } from "@diffgazer/keys";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useReviewDetailsTabKeyboard } from "../hooks/use-details-tab-keyboard";
import { IssueDetailsPane } from "./issue-details-pane";

const DETAILS_KEYBOARD_SCOPE = "issue-details-keyboard-test";

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
      isFocused={false}
    />
  );
}

function DetailsKeyboardHarness({
  enabled,
  onScroll,
  onToggleStep,
}: {
  enabled: boolean;
  onScroll: (delta: number) => void;
  onToggleStep: (step: number) => void;
}) {
  useScope(DETAILS_KEYBOARD_SCOPE);
  useReviewDetailsTabKeyboard({
    scope: DETAILS_KEYBOARD_SCOPE,
    enabled,
    selectedIssue: makeIssue({
      fixPlan: [{ step: 1, action: "Apply the fix" }],
    }),
    activeTab: "details",
    moveTab: () => "no-change",
    scrollDetails: onScroll,
    setActiveTab: () => undefined,
    enterList: () => undefined,
    onToggleStep,
  });

  return null;
}

function dispatchCancelableKey(key: string): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  // fireEvent retained: direct dispatch exposes defaultPrevented on the exact cancelable event.
  fireEvent(window, event);
  return event;
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

function expectAllEvidenceVariants() {
  expect(screen.getByRole("region", { name: "Evidence" })).toHaveTextContent(
    "const value = JSON.parse(input);",
  );
  expect(screen.getByText("Unsafe parser")).toBeInTheDocument();
  expect(screen.getByText("source:parser")).toBeInTheDocument();
  expect(screen.getByText("src/parser.ts")).toBeInTheDocument();
  expect(screen.getByText("Empty parser evidence")).toBeInTheDocument();
  expect(screen.getByText("source:empty-parser")).toBeInTheDocument();
  expect(screen.getByText("src/empty-parser.ts")).toBeInTheDocument();
  expect(
    screen.getByRole("region", { name: "Code evidence: Empty parser evidence" }),
  ).toHaveTextContent("(empty excerpt)");
  expect(screen.getByText("Documentation")).toBeInTheDocument();
  expect(screen.getByText("Parser contract")).toBeInTheDocument();
  expect(screen.getByText("docs/reference/parser")).toBeInTheDocument();
  expect(screen.getByText("Invalid input must return a typed failure.")).toBeInTheDocument();
  expect(screen.getByText("Trace evidence")).toBeInTheDocument();
  expect(screen.getByText("Failure reproduction")).toBeInTheDocument();
  expect(screen.getByText("trace:parse-invalid-input")).toBeInTheDocument();
  expect(
    screen.getByText("Malformed JSON throws before the error boundary runs."),
  ).toBeInTheDocument();
  expect(screen.getByText("External reference")).toBeInTheDocument();
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
    for (const index of malformedEvidenceRanges.keys()) {
      expect(screen.getByText(`retained excerpt ${index}`)).toBeInTheDocument();
    }
    expect(container.querySelectorAll('[data-slot="code-block-line-number"]')).toHaveLength(0);
  }

  it("prevents native scrolling and toggling defaults only while details bindings are active", () => {
    const onScroll = vi.fn();
    const onToggleStep = vi.fn();
    const { rerender } = render(
      <KeyboardProvider>
        <DetailsKeyboardHarness enabled onScroll={onScroll} onToggleStep={onToggleStep} />
      </KeyboardProvider>,
    );

    const arrowDown = dispatchCancelableKey("ArrowDown");
    const space = dispatchCancelableKey(" ");

    expect(arrowDown.defaultPrevented).toBe(true);
    expect(space.defaultPrevented).toBe(true);
    expect(onScroll).toHaveBeenCalledOnce();
    expect(onScroll).toHaveBeenCalledWith(80);
    expect(onToggleStep).toHaveBeenCalledOnce();
    expect(onToggleStep).toHaveBeenCalledWith(1);

    rerender(
      <KeyboardProvider>
        <DetailsKeyboardHarness enabled={false} onScroll={onScroll} onToggleStep={onToggleStep} />
      </KeyboardProvider>,
    );

    const nativeArrowDown = dispatchCancelableKey("ArrowDown");
    const nativeSpace = dispatchCancelableKey(" ");

    expect(nativeArrowDown.defaultPrevented).toBe(false);
    expect(nativeSpace.defaultPrevented).toBe(false);
    expect(onScroll).toHaveBeenCalledOnce();
    expect(onToggleStep).toHaveBeenCalledOnce();
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

  it("does not map excerpt rows beyond the declared source range", () => {
    renderPane(
      makeIssue({
        evidence: [
          {
            type: "code",
            title: "Bounded parser evidence",
            sourceId: "source:bounded-parser",
            file: "src/parser.ts",
            range: { start: 40, end: 42 },
            excerpt: "line 40\nline 41\nline 42\ncontext without a source line",
          },
        ],
      }),
    );

    const evidence = screen.getByRole("region", {
      name: "Code evidence: Bounded parser evidence",
    });
    const rows = [...evidence.querySelectorAll('[data-slot="code-block-line"]')];

    expect(
      rows.map((row) => row.querySelector('[data-slot="code-block-line-number"]')?.textContent),
    ).toEqual(["40", "41", "42", undefined]);
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
      drilldowns: [],
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
          drilldowns: [],
        }),
      ),
    );

    renderPane(savedReview.result.issues[0] ?? null);

    expectAllEvidenceVariants();
    expect(screen.getByText("src/auth.ts:14-18")).toBeInTheDocument();
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

      expect(screen.getAllByText("duplicateCall();")).toHaveLength(2);
      expect(screen.getAllByText("Duplicate documentation excerpt.")).toHaveLength(2);

      view.rerender(paneElement(makeIssue({ evidence: issue.evidence })));

      expect(screen.getAllByText("duplicateCall();")).toHaveLength(2);
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

  it("exposes the issue severity textually in the details heading, not only by color", () => {
    renderPane(makeIssue({ severity: "blocker", title: "Null deref crashes startup" }));

    // F-230: the colored h1 alone leaves severity inaccessible; the heading now
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

    expect(screen.getByText("src/db.ts:?")).toBeInTheDocument();
    expect(screen.queryByText("src/db.ts:0")).not.toBeInTheDocument();
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

describe("IssueDetailsPane tab stops", () => {
  it("keeps detail content out of the tab order so Tab stays a pane switcher", () => {
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

  it("keeps the plain-snippet patch block out of the tab order", () => {
    renderPane(makeIssue({ suggested_patch: "const value = safeParse(input);" }), "patch");

    expect(screen.getByRole("region", { name: "Suggested patch" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });
});
