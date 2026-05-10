import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyboardProvider } from "@diffgazer/keys";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { SEVERITY_ORDER } from "@diffgazer/core/schemas/ui";

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
  it("navigates issue list with ArrowDown immediately in list view", async () => {
    const user = userEvent.setup();
    renderView();

    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowDown}");

    expect(options[1]).toHaveAttribute("aria-selected", "true");
  });

  it("switches right-panel tabs with left and right arrows", async () => {
    const user = userEvent.setup();
    renderView();

    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Explain" })).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
  });

  it("scrolls issue details with up and down arrows after moving focus into details", async () => {
    const user = userEvent.setup();
    const originalScrollByDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollBy");
    const scrollBy = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollBy", {
      configurable: true,
      value: scrollBy,
    });

    try {
      renderView();

      screen.getByRole("listbox").focus();
      await user.keyboard("{ArrowRight}");
      expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
      await waitFor(() => expect(screen.getByRole("region", { name: "Issue details" })).toHaveFocus());

      await user.keyboard("{ArrowDown}");
      await user.keyboard("{ArrowUp}");

      expect(scrollBy).toHaveBeenNthCalledWith(1, { top: 80, behavior: "smooth" });
      expect(scrollBy).toHaveBeenNthCalledWith(2, { top: -80, behavior: "smooth" });
    } finally {
      if (originalScrollByDescriptor) {
        Object.defineProperty(HTMLElement.prototype, "scrollBy", originalScrollByDescriptor);
      } else {
        delete HTMLElement.prototype.scrollBy;
      }
    }
  });

  it("moves from focused severity filters back to the issue list with ArrowDown", async () => {
    const user = userEvent.setup();
    renderView();

    await user.keyboard("{ArrowUp}");
    const filterGroup = screen.getByRole("group", { name: "Severity filter" });
    await waitFor(() => expect(filterGroup).toContainElement(document.activeElement));

    await user.keyboard("{ArrowDown}");

    await waitFor(() => expect(screen.getByRole("listbox")).toHaveFocus());
  });

  it("moves from the last severity filter to issue details with ArrowRight", async () => {
    const user = userEvent.setup();
    renderView();

    await user.keyboard("{ArrowUp}");
    const filterGroup = screen.getByRole("group", { name: "Severity filter" });
    await waitFor(() => expect(filterGroup).toContainElement(document.activeElement));

    for (let index = 1; index < SEVERITY_ORDER.length; index += 1) {
      await user.keyboard("{ArrowRight}");
    }
    await user.keyboard("{ArrowRight}");

    await waitFor(() => expect(screen.getByRole("region", { name: "Issue details" })).toHaveFocus());
  });
});
