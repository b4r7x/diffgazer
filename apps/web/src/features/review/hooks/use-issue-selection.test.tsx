import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { makeIssue } from "@/testing/factories";
import { useIssueSelection } from "./use-issue-selection";

const firstIssue = makeIssue({ id: "issue-1", title: "First issue" });
const secondIssue = makeIssue({ id: "issue-2", title: "Second issue" });

function Subject({ sourceKey }: { sourceKey: string }) {
  const selection = useIssueSelection({
    sourceKey,
    filteredIssues: [firstIssue, secondIssue],
  });

  return (
    <div>
      <p>{selection.selectedIssue?.title}</p>
      <button type="button" onClick={() => selection.setSelectedIssueId("issue-2")}>
        Select second
      </button>
    </div>
  );
}

describe("useIssueSelection", () => {
  it("resets to the first issue when the source list changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Subject sourceKey="all" />);

    expect(screen.getByText("First issue")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select second" }));
    expect(screen.getByText("Second issue")).toBeInTheDocument();

    rerender(<Subject sourceKey="high" />);

    expect(screen.getByText("First issue")).toBeInTheDocument();
  });

  it("does not restore a previous selection when returning to an earlier source list", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Subject sourceKey="all" />);

    await user.click(screen.getByRole("button", { name: "Select second" }));
    expect(screen.getByText("Second issue")).toBeInTheDocument();

    rerender(<Subject sourceKey="high" />);

    expect(screen.getByText("First issue")).toBeInTheDocument();

    rerender(<Subject sourceKey="all" />);

    expect(screen.getByText("First issue")).toBeInTheDocument();
  });
});
