import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { IssueDetailsPane } from "./issue-details-pane";

describe("IssueDetailsPane", () => {
  it("shows an empty details state until an issue is selected", () => {
    render(
      <IssueDetailsPane
        issue={null}
        activeTab="details"
        onTabChange={vi.fn()}
        completedSteps={new Set<number>()}
        onToggleStep={vi.fn()}
        isFocused={false}
      />,
    );

    expect(screen.getByText("Select an issue to view details")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Details" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Patch" })).not.toBeInTheDocument();
  });
});
