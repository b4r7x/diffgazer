import type { IssueTab } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IssueDetailsPane } from "./issue-details-pane";

function renderPane(
  issue: ReviewIssue | null,
  activeTab: IssueTab = "details",
  callbacks: {
    onTabChange?: (tab: IssueTab) => void;
    onTabsBoundaryReached?: (direction: "previous" | "next") => void;
  } = {},
) {
  return render(
    <IssueDetailsPane
      issue={issue}
      activeTab={activeTab}
      onTabChange={callbacks.onTabChange ?? vi.fn()}
      onTabsBoundaryReached={callbacks.onTabsBoundaryReached}
      completedSteps={new Set<number>()}
      onToggleStep={vi.fn()}
      isFocused={false}
    />,
  );
}

describe("IssueDetailsPane", () => {
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

    expect(screen.getByText("src/db.ts")).toBeInTheDocument();
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

  it("renders a plain replacement snippet as a diff against the issue's code evidence", () => {
    renderPane(
      makeIssue({
        suggested_patch: "const value = safeParse(input);",
        evidence: [
          {
            type: "code",
            title: "Unsafe parse",
            sourceId: "src/example.ts",
            excerpt: "const value = JSON.parse(input);",
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
