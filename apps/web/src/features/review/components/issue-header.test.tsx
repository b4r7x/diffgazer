import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IssueHeader } from "./issue-header";

const LONG_LOCATION = "cli/diffgazer/src/features/history/components/list.tsx:120-140";

function renderHeader(location = LONG_LOCATION) {
  return render(
    <IssueHeader
      title="History list drops the selected row"
      severity="high"
      presentation={{ category: "correctness", confidence: "88%", location }}
    />,
  );
}

describe("IssueHeader", () => {
  it("keeps the file name and line range of a long location visible without a tooltip", () => {
    renderHeader();

    const tail = screen.getByText("/list.tsx:120-140");
    expect(tail.closest("[title]")).toHaveAttribute("title", LONG_LOCATION);
  });

  it("announces the severity as text in the issue heading", () => {
    renderHeader();

    expect(
      screen.getByRole("heading", { name: /high severity.*history list drops the selected row/i }),
    ).toBeInTheDocument();
  });
});
