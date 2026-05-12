import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IssuePreviewItem } from "./issue-preview-item";

const BASE_PROPS = {
  title: "SQL Injection Risk",
  file: "src/db.ts",
  line: 42,
  category: "security",
  severity: "high" as const,
};

describe("IssuePreviewItem", () => {
  it("renders a button when onClick is provided", () => {
    render(<IssuePreviewItem {...BASE_PROPS} onClick={() => {}} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("does not render as interactive when onClick is omitted", () => {
    render(<IssuePreviewItem {...BASE_PROPS} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("SQL Injection Risk")).toBeInTheDocument();
  });

  it("calls onClick when the button is clicked", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<IssuePreviewItem {...BASE_PROPS} onClick={onClick} />);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("displays severity label and category", () => {
    render(<IssuePreviewItem {...BASE_PROPS} />);
    expect(screen.getByText("HIGH")).toBeInTheDocument();
    expect(screen.getByText("security")).toBeInTheDocument();
  });
});
