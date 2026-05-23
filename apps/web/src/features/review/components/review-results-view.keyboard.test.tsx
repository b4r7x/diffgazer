import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyboardProvider } from "@diffgazer/keys";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { SEVERITY_ORDER } from "@diffgazer/core/schemas/presentation";
import { Footer } from "@/components/layout";
import { FooterProvider, useFooterData } from "@diffgazer/core/footer";

// Boundary mock: Router is the routing library; tests provide a stub Router context so navigation assertions can be made without a real route tree.
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({
    history: {
      back: vi.fn(),
    },
    navigate: vi.fn(),
  }),
  useCanGoBack: () => false,
  useLocation: () => ({ pathname: "/review/test-id" }),
}));

import { ReviewResultsView } from "./review-results-view";

interface IssueOptions {
  suggestedPatch?: string | null;
  fixPlan?: ReviewIssue["fixPlan"];
  severity?: ReviewIssue["severity"];
}

const suggestedPatch = "--- a/src/example.ts\n+++ b/src/example.ts\n@@\n-const a = 1;\n+const a = 2;";

function makeIssue(id: string, title: string, options: IssueOptions = {}): ReviewIssue {
  return {
    id,
    severity: options.severity ?? "high",
    category: "correctness",
    title,
    file: "src/example.ts",
    line_start: 10,
    line_end: 12,
    rationale: `${title} rationale`,
    recommendation: `${title} recommendation`,
    suggested_patch: options.suggestedPatch === undefined ? suggestedPatch : options.suggestedPatch,
    confidence: 0.9,
    symptom: `${title} symptom`,
    whyItMatters: `${title} impact`,
    fixPlan: options.fixPlan,
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

function FooterView() {
  const { shortcuts, rightShortcuts } = useFooterData();
  return <Footer shortcuts={shortcuts} rightShortcuts={rightShortcuts} />;
}

function renderView(issues: ReviewIssue[] = [makeIssue("issue-1", "Issue one"), makeIssue("issue-2", "Issue two")]) {
  return render(
    <KeyboardProvider>
      <FooterProvider>
        <ReviewResultsView issues={issues} reviewId="review-1" />
        <FooterView />
      </FooterProvider>
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

  it("navigates issue list with j and k in visible order", async () => {
    const user = userEvent.setup();
    renderView([
      makeIssue("issue-1", "Issue one"),
      makeIssue("issue-2", "Issue two"),
      makeIssue("issue-3", "Issue three"),
    ]);

    const options = screen.getAllByRole("option");

    await user.keyboard("jj");
    expect(options[2]).toHaveAttribute("aria-selected", "true");

    await user.keyboard("k");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
  });

  it("moves from an empty issue list boundary back to severity filters", async () => {
    const user = userEvent.setup();
    renderView([]);

    await user.keyboard("{ArrowUp}");

    const filterGroup = screen.getByRole("group", { name: "Severity filter" });
    await waitFor(() =>
      expect(filterGroup).toContainElement(document.activeElement as HTMLElement | null),
    );
  });

  it("switches right-panel tabs with left and right arrows", async () => {
    const user = userEvent.setup();
    renderView();

    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Explain" })).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
  });

  it("falls back to details when the selected issue has no patch tab", async () => {
    const user = userEvent.setup();
    renderView([
      makeIssue("issue-1", "Issue one"),
      makeIssue("issue-2", "Issue two", { suggestedPatch: null }),
    ]);

    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(screen.getByRole("region", { name: "Issue details" })).toHaveFocus());
    await user.keyboard("4");
    expect(screen.getByRole("tab", { name: "Patch" })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("option", { name: /issue two/i }));

    expect(screen.queryByRole("tab", { name: "Patch" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Issue two symptom")).toBeInTheDocument();
  });

  it("keeps completed fix-plan steps scoped to the selected issue", async () => {
    const user = userEvent.setup();
    renderView([
      makeIssue("issue-1", "Issue one", {
        fixPlan: [
          { step: 1, action: "Inspect issue one" },
          { step: 2, action: "Patch issue one" },
        ],
      }),
      makeIssue("issue-2", "Issue two", {
        fixPlan: [
          { step: 1, action: "Inspect issue two" },
          { step: 2, action: "Patch issue two" },
        ],
      }),
    ]);

    const firstIssuePatchStep = screen.getByRole("checkbox", { name: "Patch issue one" });
    expect(firstIssuePatchStep).not.toBeChecked();

    await user.click(firstIssuePatchStep);
    expect(firstIssuePatchStep).toBeChecked();

    await user.click(screen.getByRole("option", { name: /issue two/i }));
    expect(screen.getByRole("checkbox", { name: "Inspect issue two" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Patch issue two" })).not.toBeChecked();

    await user.click(screen.getByRole("option", { name: /issue one/i }));
    expect(screen.getByRole("checkbox", { name: "Patch issue one" })).toBeChecked();
  });

  it("renders footer hints for the active results zone", async () => {
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByText("Select Issue")).toBeInTheDocument();
    expect(screen.getByText("Back")).toBeInTheDocument();

    await user.keyboard("{ArrowRight}");

    expect(await screen.findByText("Switch Tab")).toBeInTheDocument();
    expect(screen.getByText("1-4")).toBeInTheDocument();
  });

  it("scrolls issue details with up and down arrows after moving focus into details", async () => {
    const user = userEvent.setup();
    const originalScrollByDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollBy");
    const scrollOptions: ScrollToOptions[] = [];
    // Patch `scrollBy` (not `scrollIntoView`): the public keyboard contract is
    // "advance one viewport per ArrowDown / ArrowUp", which the component
    // implements via scrollBy. Coupling the test to scrollBy locks in that
    // contract and would catch a regression to per-element scrollIntoView.
    const scrollBy = vi.fn((options: ScrollToOptions) => {
      scrollOptions.push(options);
    });
    Object.defineProperty(HTMLElement.prototype, "scrollBy", {
      configurable: true,
      value: scrollBy,
    });

    try {
      renderView();

      // Direct .focus() is necessary here: the scrollBy monkey-patch prevents
      // the component's auto-focus effect from running before keyboard events.
      screen.getByRole("listbox").focus();
      await user.keyboard("{ArrowRight}");
      expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
      await waitFor(() => expect(screen.getByRole("region", { name: "Issue details" })).toHaveFocus());

      await user.keyboard("{ArrowDown}");
      await user.keyboard("{ArrowUp}");

      // jsdom has no scroll layout; capture scroll intent via mockImplementation
      expect(scrollOptions).toHaveLength(2);
      expect(scrollOptions[0]?.top).toBeGreaterThan(0);
      expect(scrollOptions[1]?.top).toBeLessThan(0);
    } finally {
      if (originalScrollByDescriptor) {
        Object.defineProperty(HTMLElement.prototype, "scrollBy", originalScrollByDescriptor);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "scrollBy");
      }
    }
  });

  it("moves from focused severity filters back to the issue list with ArrowDown", async () => {
    const user = userEvent.setup();
    renderView();

    await user.keyboard("{ArrowUp}");
    const filterGroup = screen.getByRole("group", { name: "Severity filter" });
    await waitFor(() =>
      expect(filterGroup).toContainElement(document.activeElement as HTMLElement | null),
    );

    await user.keyboard("{ArrowDown}");

    await waitFor(() => expect(screen.getByRole("listbox")).toHaveFocus());
  });

  it("moves from the last severity filter to issue details with ArrowRight", async () => {
    const user = userEvent.setup();
    renderView();

    await user.keyboard("{ArrowUp}");
    const filterGroup = screen.getByRole("group", { name: "Severity filter" });
    await waitFor(() =>
      expect(filterGroup).toContainElement(document.activeElement as HTMLElement | null),
    );

    for (let index = 1; index < SEVERITY_ORDER.length; index += 1) {
      await user.keyboard("{ArrowRight}");
    }
    await user.keyboard("{ArrowRight}");

    await waitFor(() => expect(screen.getByRole("region", { name: "Issue details" })).toHaveFocus());
  });

  it("renders a passed-review empty state when there are no issues", () => {
    renderView([]);

    expect(screen.getByText("No issues found")).toBeInTheDocument();
    expect(screen.getByText("No issues in this review")).toBeInTheDocument();
    expect(screen.getByText("This analysis passed without findings.")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("distinguishes filtered-out issues from passed reviews", async () => {
    const user = userEvent.setup();
    renderView([
      makeIssue("issue-1", "High issue", { severity: "high" }),
    ]);

    await user.click(screen.getByRole("button", { name: /low severity/i }));

    expect(screen.getByText(/No issues match the current filters/i)).toBeInTheDocument();
    expect(screen.getByText("No issues match this filter")).toBeInTheDocument();
    expect(screen.getByText("Choose another severity to continue.")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("toggles multiple severity filters and clears them via [Reset]", async () => {
    const user = userEvent.setup();
    renderView([
      makeIssue("issue-1", "High issue", { severity: "high" }),
      makeIssue("issue-2", "Medium issue", { severity: "medium" }),
      makeIssue("issue-3", "Low issue", { severity: "low" }),
    ]);

    const high = screen.getByRole("button", { name: /high severity/i });
    const medium = screen.getByRole("button", { name: /med severity/i });

    await user.click(high);
    expect(high).toHaveAttribute("aria-pressed", "true");
    await user.click(medium);
    expect(medium).toHaveAttribute("aria-pressed", "true");
    expect(high).toHaveAttribute("aria-pressed", "true");

    expect(screen.getAllByRole("option")).toHaveLength(2);

    const resetButton = screen.getByRole("button", { name: /reset severity filter/i });
    await user.click(resetButton);

    expect(high).toHaveAttribute("aria-pressed", "false");
    expect(medium).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("reaches Reset via ArrowRight from the last severity when filter is active", async () => {
    const user = userEvent.setup();
    renderView([
      makeIssue("issue-1", "High issue", { severity: "high" }),
    ]);

    await user.keyboard("{ArrowUp}");
    const filterGroup = screen.getByRole("group", { name: "Severity filter" });
    await waitFor(() =>
      expect(filterGroup).toContainElement(document.activeElement as HTMLElement | null),
    );

    await user.keyboard("{ArrowRight}");
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: /high severity/i })).toHaveAttribute("aria-pressed", "true");
    const reset = await screen.findByRole("button", { name: /reset severity filter/i });
    expect(reset).toBeInTheDocument();

    for (let i = 0; i < SEVERITY_ORDER.length - 1; i += 1) {
      await user.keyboard("{ArrowRight}");
    }

    await waitFor(() => expect(reset).toHaveFocus());
  });

  it("activates reset via 'r' shortcut when a severity filter is active", async () => {
    const user = userEvent.setup();
    renderView([
      makeIssue("issue-1", "High issue", { severity: "high" }),
      makeIssue("issue-2", "Low issue", { severity: "low" }),
    ]);

    await user.click(screen.getByRole("button", { name: /high severity/i }));

    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /reset severity filter/i })).toBeInTheDocument();

    await user.keyboard("r");

    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(2));
    expect(screen.queryByRole("button", { name: /reset severity filter/i })).not.toBeInTheDocument();
  });
});
