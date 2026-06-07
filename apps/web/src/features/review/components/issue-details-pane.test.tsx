import type { IssueTab } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeIssue } from "@/testing/factories";
import { IssueDetailsPane } from "./issue-details-pane";

function renderPane(issue: ReviewIssue | null, activeTab: IssueTab = "details") {
  return render(
    <IssueDetailsPane
      issue={issue}
      activeTab={activeTab}
      onTabChange={vi.fn()}
      completedSteps={new Set<number>()}
      onToggleStep={vi.fn()}
      isFocused={false}
    />,
  );
}

describe("IssueDetailsPane", () => {
  it("shows an empty details state until an issue is selected", () => {
    renderPane(null);

    expect(screen.getByText("Select an issue to view details")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Details" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Patch" })).not.toBeInTheDocument();
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
});
