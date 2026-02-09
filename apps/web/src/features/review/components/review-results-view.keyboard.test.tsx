import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { KeyboardProvider } from "@diffgazer/keyboard";
import type { ReviewIssue } from "@diffgazer/schemas/review";

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({
    history: {
      back: vi.fn(),
    },
  }),
}));

vi.mock("@/hooks/use-page-footer", () => ({
  usePageFooter: () => {},
}));

import { ReviewResultsView } from "./review-results-view";

function makeIssue(id: string, title: string): ReviewIssue {
  return {
    id,
    severity: "high",
    category: "correctness",
    title,
    file: "src/example.ts",
    line_start: 10,
    line_end: 12,
    rationale: `${title} rationale`,
    recommendation: `${title} recommendation`,
    suggested_patch: "--- a/src/example.ts\n+++ b/src/example.ts\n@@\n-const a = 1;\n+const a = 2;",
    confidence: 0.9,
    symptom: `${title} symptom`,
    whyItMatters: `${title} impact`,
    evidence: [
      {
        type: "code",
        title: `${title} evidence`,
        sourceId: `${id}-source`,
        excerpt: "const a = 1;",
      },
    ],
    trace: [
      {
        step: 1,
        tool: "reviewer",
        inputSummary: "input",
        outputSummary: "output",
        timestamp: "2026-01-01T00:00:00.000Z",
      },
    ],
  };
}

function renderView() {
  const issues = [makeIssue("issue-1", "Issue one"), makeIssue("issue-2", "Issue two")];

  return render(
    <KeyboardProvider>
      <ReviewResultsView issues={issues} reviewId="review-1" />
    </KeyboardProvider>,
  );
}

describe("ReviewResultsView keyboard regression", () => {
  it("navigates issue list with ArrowDown immediately in list view", () => {
    renderView();

    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(window, { key: "ArrowDown" });

    expect(options[1]).toHaveAttribute("aria-selected", "true");
  });

  it("switches right-panel tabs with left/right and scrolls details with up/down", () => {
    const { container } = renderView();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Explain" })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");

    const scrollAreas = container.querySelectorAll<HTMLDivElement>(".scrollbar-thin");
    const detailsScrollArea = scrollAreas[0];
    expect(detailsScrollArea).toBeTruthy();

    const scrollBy = vi.fn();
    Object.defineProperty(detailsScrollArea, "scrollBy", {
      value: scrollBy,
      configurable: true,
      writable: true,
    });

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowUp" });

    expect(scrollBy).toHaveBeenNthCalledWith(1, { top: 80, behavior: "smooth" });
    expect(scrollBy).toHaveBeenNthCalledWith(2, { top: -80, behavior: "smooth" });
  });
});
