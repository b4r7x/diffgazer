import { makeIssue } from "@diffgazer/core/testing/factories";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useIssueSelection } from "./use-issue-selection";

const firstIssue = makeIssue({ id: "issue-1", title: "First issue" });
const secondIssue = makeIssue({ id: "issue-2", title: "Second issue" });

function Subject({
  sourceKey = "all",
  initialIssueId,
}: {
  sourceKey?: string;
  initialIssueId?: string | null;
}) {
  const selection = useIssueSelection({
    sourceKey,
    initialIssueId,
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

  it("honors the initial route issue id deep link", () => {
    render(<Subject initialIssueId="issue-2" />);

    expect(screen.getByText("Second issue")).toBeInTheDocument();
  });

  it("follows the route issue id when it changes on the same route", () => {
    const { rerender } = render(<Subject initialIssueId="issue-1" />);

    expect(screen.getByText("First issue")).toBeInTheDocument();

    rerender(<Subject initialIssueId="issue-2" />);

    expect(screen.getByText("Second issue")).toBeInTheDocument();
  });

  it("keeps a local selection when the route issue id is unchanged", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Subject initialIssueId="issue-1" />);

    await user.click(screen.getByRole("button", { name: "Select second" }));
    expect(screen.getByText("Second issue")).toBeInTheDocument();

    rerender(<Subject initialIssueId="issue-1" />);

    expect(screen.getByText("Second issue")).toBeInTheDocument();
  });
});
