import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { IssueDetailsPane } from "./issue-details-pane";

describe("IssueDetailsPane", () => {
  it("uses UI ScrollArea for the right details panel content", () => {
    const { container } = render(
      <IssueDetailsPane
        issue={null}
        activeTab="details"
        onTabChange={vi.fn()}
        completedSteps={new Set<number>()}
        onToggleStep={vi.fn()}
        isFocused={false}
      />,
    );

    const scrollArea = container.querySelector(".scrollbar-thin");
    expect(scrollArea).toBeTruthy();
    expect(scrollArea?.className.includes("min-h-0")).toBe(true);
  });
});
