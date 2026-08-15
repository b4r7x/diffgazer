import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IssuePreviewItem } from "./issue-preview-item";

const BASE_PROPS = {
  title: "SQL Injection Risk",
  file: "src/db.ts",
  line: 42,
  category: "security",
  severity: "high" as const,
};

describe("IssuePreviewItem", () => {
  it("renders the preview as static content, never as a control", () => {
    render(<IssuePreviewItem {...BASE_PROPS} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("SQL Injection Risk")).toBeInTheDocument();
  });

  it("displays severity label and category", () => {
    render(<IssuePreviewItem {...BASE_PROPS} />);
    expect(screen.getByText("HIGH")).toBeInTheDocument();
    expect(screen.getByText("security")).toBeInTheDocument();
  });

  it("speaks severity as a word, never as a glyph the reader has to decode", () => {
    const { container } = render(<IssuePreviewItem {...BASE_PROPS} />);

    expect(container).not.toHaveTextContent("▲");
  });

  it("keeps the complete location available when the visible path is truncated", () => {
    const file = "src/features/review/components/a/very/long/location/issue-preview-item.tsx";
    render(<IssuePreviewItem {...BASE_PROPS} file={file} />);

    // The location renders through PathValue, which splits it so the ellipsis
    // lands on the directories; the whole path stays readable in the tooltip.
    expect(screen.getByTitle(`${file}:42`)).toHaveTextContent(`${file}:42`);
  });
});
