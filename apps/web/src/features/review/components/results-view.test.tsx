import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import { SEVERITY_ORDER } from "@diffgazer/core/schemas/presentation";
import type { ReviewIssue } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { KeyboardProvider } from "@diffgazer/keys";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Footer } from "@/components/layout/footer";
import { MAIN_CONTENT_ID } from "@/lib/main-content";

// Boundary mock: Router is the routing library; tests provide a stub Router context so navigation assertions can be made without a real route tree.
const { backMock, navigateMock } = vi.hoisted(() => ({
  backMock: vi.fn(),
  navigateMock: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({
    history: {
      back: backMock,
    },
    navigate: navigateMock,
  }),
  useCanGoBack: () => false,
  useLocation: () => ({ pathname: "/review/test-id" }),
}));

import { ReviewResultsView } from "./results-view";

interface IssueOptions {
  suggestedPatch?: string | null;
  trace?: ReviewIssue["trace"];
  fixPlan?: ReviewIssue["fixPlan"];
  severity?: ReviewIssue["severity"];
}

const suggestedPatch =
  "--- a/src/example.ts\n+++ b/src/example.ts\n@@\n-const a = 1;\n+const a = 2;";

function createReviewIssue(id: string, title: string, options: IssueOptions = {}): ReviewIssue {
  return makeIssue({
    id,
    severity: options.severity ?? "high",
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
    trace: options.trace ?? [
      {
        step: 1,
        tool: "reviewer",
        inputSummary: "input",
        outputSummary: "output",
        timestamp: "2026-01-01T00:00:00.000Z",
      },
    ],
  });
}

function FooterView() {
  const { shortcuts, rightShortcuts } = useFooterData();
  return <Footer shortcuts={shortcuts} rightShortcuts={rightShortcuts} />;
}

/** jsdom has no scroll layout; emulate scroll APIs on the details region via scrollTop. */
function installIssueDetailsScrollShim(details: HTMLElement) {
  Object.defineProperty(details, "scrollTop", { configurable: true, writable: true, value: 0 });
  Object.defineProperty(details, "scrollBy", {
    configurable: true,
    value(options: ScrollToOptions = {}) {
      details.scrollTop += options.top ?? 0;
    },
  });
}

function renderView(
  issues: ReviewIssue[] = [
    createReviewIssue("issue-1", "Issue one"),
    createReviewIssue("issue-2", "Issue two"),
  ],
  droppedDuplicates?: number,
) {
  return render(
    <KeyboardProvider>
      <FooterProvider>
        <ReviewResultsView
          issues={issues}
          reviewId="review-1"
          droppedDuplicates={droppedDuplicates}
        />
        <FooterView />
      </FooterProvider>
    </KeyboardProvider>,
  );
}

describe("ReviewResultsView keyboard regression", () => {
  it("renders the persisted duplicate-collapse count transition", () => {
    renderView([createReviewIssue("issue-1", "Issue one")], 1);

    expect(screen.getByRole("note")).toHaveTextContent(
      "1 duplicate issue collapsed across lenses (2 → 1 issue)",
    );
  });

  it("auto-focuses the issue list zone on mount so aria-activedescendant is read", async () => {
    renderView();

    // Without focus.autoFocus the listbox never receives DOM focus on mount and a
    // screen reader hears nothing while j/k move aria-activedescendant.
    await waitFor(() => expect(screen.getByRole("listbox")).toHaveFocus());
  });

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
      createReviewIssue("issue-1", "Issue one"),
      createReviewIssue("issue-2", "Issue two"),
      createReviewIssue("issue-3", "Issue three"),
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
      createReviewIssue("issue-1", "Issue one"),
      createReviewIssue("issue-2", "Issue two", { suggestedPatch: null }),
    ]);

    await user.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Issue details" })).toHaveFocus(),
    );
    await user.keyboard("4");
    expect(screen.getByRole("tab", { name: "Patch" })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("option", { name: /issue two/i }));

    expect(screen.queryByRole("tab", { name: "Patch" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Issue two symptom")).toBeInTheDocument();
  });

  it("ignores 3 for a patch-only issue while 4 still selects Patch", async () => {
    const user = userEvent.setup();
    renderView([createReviewIssue("issue-1", "Patch-only issue", { trace: [] })]);

    await user.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Issue details" })).toHaveFocus(),
    );

    await user.keyboard("4");
    expect(screen.getByRole("tab", { name: "Patch" })).toHaveAttribute("aria-selected", "true");

    await user.keyboard("3");
    expect(screen.getByRole("tab", { name: "Patch" })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps completed fix-plan steps scoped to the selected issue", async () => {
    const user = userEvent.setup();
    renderView([
      createReviewIssue("issue-1", "Issue one", {
        fixPlan: [
          { step: 1, action: "Inspect issue one" },
          { step: 2, action: "Patch issue one" },
        ],
      }),
      createReviewIssue("issue-2", "Issue two", {
        fixPlan: [
          { step: 1, action: "Inspect issue two" },
          { step: 2, action: "Patch issue two" },
        ],
      }),
    ]);

    const firstIssuePatchStep = screen.getByRole("checkbox", { name: "2. Patch issue one" });
    expect(firstIssuePatchStep).not.toBeChecked();

    await user.click(firstIssuePatchStep);
    expect(firstIssuePatchStep).toBeChecked();

    await user.click(screen.getByRole("option", { name: /issue two/i }));
    expect(screen.getByRole("checkbox", { name: "1. Inspect issue two" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "2. Patch issue two" })).not.toBeChecked();

    await user.click(screen.getByRole("option", { name: /issue one/i }));
    expect(screen.getByRole("checkbox", { name: "2. Patch issue one" })).toBeChecked();
  });

  it("resets issue-scoped scroll while retaining the selected tab", async () => {
    const user = userEvent.setup();
    renderView([
      createReviewIssue("issue-1", "Issue one", {
        fixPlan: [
          { step: 1, action: "Inspect issue one" },
          { step: 2, action: "Patch issue one" },
        ],
      }),
      createReviewIssue("issue-2", "Issue two", {
        fixPlan: [
          { step: 1, action: "Inspect issue two" },
          { step: 2, action: "Patch issue two" },
        ],
      }),
    ]);

    screen.getByRole("listbox").focus();
    await user.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Issue details" })).toHaveFocus(),
    );

    await user.keyboard("j");
    await user.keyboard("{Enter}");
    expect(screen.getByRole("checkbox", { name: "2. Patch issue one" })).toBeChecked();

    const detailsScroll = screen.getByRole("region", { name: "Issue details" });
    detailsScroll.scrollTop = 240;
    await user.click(screen.getByRole("tab", { name: "Explain" }));
    expect(screen.getByRole("tab", { name: "Explain" })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("option", { name: /issue two/i }));
    expect(detailsScroll.scrollTop).toBe(0);
    expect(screen.getByRole("tab", { name: "Explain" })).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Issue details" })).toHaveFocus(),
    );
    await user.keyboard("1");
    await user.keyboard("{Enter}");
    expect(screen.getByRole("checkbox", { name: "1. Inspect issue two" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "2. Patch issue two" })).not.toBeChecked();
  });

  it("resets step focus while retaining completion when returning to an issue", async () => {
    const user = userEvent.setup();
    renderView([
      createReviewIssue("issue-1", "Issue one", {
        fixPlan: [
          { step: 1, action: "Inspect issue one" },
          { step: 2, action: "Patch issue one" },
        ],
      }),
      createReviewIssue("issue-2", "Issue two", {
        fixPlan: [
          { step: 1, action: "Inspect issue two" },
          { step: 2, action: "Patch issue two" },
        ],
      }),
    ]);

    screen.getByRole("listbox").focus();
    await user.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Issue details" })).toHaveFocus(),
    );
    await user.keyboard("j");
    await user.keyboard("{Enter}");
    expect(screen.getByRole("checkbox", { name: "2. Patch issue one" })).toBeChecked();

    await user.click(screen.getByRole("option", { name: /issue two/i }));
    await user.click(screen.getByRole("option", { name: /issue one/i }));
    await user.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Issue details" })).toHaveFocus(),
    );
    await user.keyboard("{Enter}");
    expect(screen.getByRole("checkbox", { name: "1. Inspect issue one" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "2. Patch issue one" })).toBeChecked();
  });

  it("toggles fix-plan steps keyboard-only from the details zone", async () => {
    const user = userEvent.setup();
    renderView([
      createReviewIssue("issue-1", "Issue one", {
        fixPlan: [
          { step: 1, action: "Inspect issue one" },
          { step: 2, action: "Patch issue one" },
        ],
      }),
    ]);

    // Move focus into the details zone (default tab is "details", which renders
    // the fix plan).
    screen.getByRole("listbox").focus();
    await user.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Issue details" })).toHaveFocus(),
    );

    const firstStep = screen.getByRole("checkbox", { name: "1. Inspect issue one" });
    const secondStep = screen.getByRole("checkbox", { name: "2. Patch issue one" });
    expect(firstStep).not.toBeChecked();

    // Space toggles the focused (first) step without any pointer interaction.
    await user.keyboard(" ");
    expect(firstStep).toBeChecked();

    // j moves the focused step down; Space toggles the second step.
    await user.keyboard("j ");
    expect(secondStep).toBeChecked();

    // k moves back up; Space untoggles the first step.
    await user.keyboard("k ");
    expect(firstStep).not.toBeChecked();
  });

  it("toggles the pointer-focused fix-plan step with the next Enter", async () => {
    const user = userEvent.setup();
    renderView([
      createReviewIssue("issue-1", "Issue one", {
        fixPlan: [
          { step: 1, action: "Inspect issue one" },
          { step: 2, action: "Patch issue one" },
        ],
      }),
    ]);

    const firstStep = screen.getByRole("checkbox", { name: "1. Inspect issue one" });
    const secondStep = screen.getByRole("checkbox", { name: "2. Patch issue one" });

    await user.click(secondStep);
    expect(firstStep).not.toBeChecked();
    expect(secondStep).toBeChecked();

    await user.keyboard("{Enter}");

    expect(firstStep).not.toBeChecked();
    expect(secondStep).not.toBeChecked();
  });

  it("keeps native Tab on the skip link outside main while cycling panes inside main", async () => {
    render(
      <KeyboardProvider>
        <FooterProvider>
          <a href={`#${MAIN_CONTENT_ID}`}>Skip to content</a>
          <main id={MAIN_CONTENT_ID}>
            <ReviewResultsView
              issues={[createReviewIssue("issue-1", "Issue one")]}
              reviewId="review-1"
            />
          </main>
          <FooterView />
        </FooterProvider>
      </KeyboardProvider>,
    );

    await waitFor(() => expect(screen.getByRole("listbox")).toHaveFocus());

    const skipLink = screen.getByRole("link", { name: "Skip to content" });
    skipLink.focus();
    expect(skipLink).toHaveFocus();

    // fireEvent retained: low-level Tab dispatch asserts the main boundary declines Tab on the skip link.
    const prevented = !fireEvent.keyDown(window, { key: "Tab", code: "Tab" });
    expect(prevented).toBe(false);

    screen.getByRole("listbox").focus();
    // fireEvent retained: low-level Tab dispatch asserts the document-scope cycle claims Tab inside main.
    const preventedInside = !fireEvent.keyDown(window, { key: "Tab", code: "Tab" });
    expect(preventedInside).toBe(true);

    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Issue details" })).toHaveFocus(),
    );
  });

  it("keeps native Tab inside editable targets", async () => {
    render(
      <KeyboardProvider>
        <FooterProvider>
          <ReviewResultsView
            issues={[createReviewIssue("issue-1", "Issue one")]}
            reviewId="review-1"
          />
          <input aria-label="Notes" />
          <FooterView />
        </FooterProvider>
      </KeyboardProvider>,
    );

    await waitFor(() => expect(screen.getByRole("listbox")).toHaveFocus());

    const input = screen.getByRole("textbox", { name: "Notes" });
    input.focus();
    expect(input).toHaveFocus();

    // fireEvent retained: low-level Tab dispatch asserts editable targets keep native Tab (no preventDefault).
    const prevented = !fireEvent.keyDown(input, { key: "Tab", code: "Tab" });
    expect(prevented).toBe(false);
  });

  it("cycles panes with Tab from anywhere, including a focused tab trigger", async () => {
    const user = userEvent.setup();
    renderView();

    await waitFor(() => expect(screen.getByRole("listbox")).toHaveFocus());

    await user.keyboard("{Tab}");
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Issue details" })).toHaveFocus(),
    );

    // Land focus on a tab trigger; Tab must still cycle to the next pane.
    await user.click(screen.getByRole("tab", { name: "Explain" }));
    await waitFor(() => expect(screen.getByRole("tab", { name: "Explain" })).toHaveFocus());

    await user.keyboard("{Tab}");
    const filterGroup = screen.getByRole("group", { name: "Severity filter" });
    await waitFor(() =>
      expect(filterGroup).toContainElement(document.activeElement as HTMLElement | null),
    );

    await user.keyboard("{Tab}");
    await waitFor(() => expect(screen.getByRole("listbox")).toHaveFocus());
  });

  it("treats focus landing on a tab trigger as the details zone", async () => {
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByText("Select Issue")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Explain" }));

    // The footer follows the zone, so it must switch to details hints.
    expect(await screen.findByText("Switch Tab")).toBeInTheDocument();
    expect(screen.queryByText("Select Issue")).not.toBeInTheDocument();
  });

  it("returns to the issue list when ArrowLeft hits the leftmost tab trigger", async () => {
    const user = userEvent.setup();
    renderView();

    await waitFor(() => expect(screen.getByRole("listbox")).toHaveFocus());

    const detailsTab = screen.getByRole("tab", { name: "Details" });
    await user.click(detailsTab);
    await waitFor(() => expect(detailsTab).toHaveFocus());

    await user.keyboard("{ArrowLeft}");

    await waitFor(() => expect(screen.getByRole("listbox")).toHaveFocus());
    // The boundary must not loop the tab strip to the last tab.
    expect(detailsTab).toHaveAttribute("aria-selected", "true");
  });

  it("layers Escape: details returns to the issue list, list leaves the screen", async () => {
    const user = userEvent.setup();
    renderView();
    navigateMock.mockClear();
    backMock.mockClear();

    await waitFor(() => expect(screen.getByRole("listbox")).toHaveFocus());
    await user.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Issue details" })).toHaveFocus(),
    );

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.getByRole("listbox")).toHaveFocus());
    expect(navigateMock).not.toHaveBeenCalled();
    expect(backMock).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");

    expect(navigateMock).toHaveBeenCalledWith({ to: "/" });
  });

  it("renders footer hints for the active results zone", async () => {
    const user = userEvent.setup();
    renderView();

    expect(await screen.findByText("Select Issue")).toBeInTheDocument();
    expect(screen.getByText("Switch Pane")).toBeInTheDocument();
    expect(screen.getByText("Back")).toBeInTheDocument();

    await user.keyboard("{ArrowRight}");

    expect(await screen.findByText("Switch Tab")).toBeInTheDocument();
    expect(screen.getByText("1-4")).toBeInTheDocument();
    expect(screen.getByText("Switch Pane")).toBeInTheDocument();
    // In the details zone Esc steps back to the issue list, not off the screen.
    expect(screen.queryByText("Back")).not.toBeInTheDocument();
    expect(screen.getAllByText("Issue List").length).toBeGreaterThan(0);
  });

  it("scrolls issue details with up and down arrows after moving focus into details", async () => {
    const user = userEvent.setup();
    renderView();

    await waitFor(() => expect(screen.getByRole("listbox")).toHaveFocus());
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Issue details" })).toHaveFocus(),
    );

    const detailsScroll = screen.getByRole("region", { name: "Issue details" });
    installIssueDetailsScrollShim(detailsScroll);
    expect(detailsScroll.scrollTop).toBe(0);

    await user.keyboard("{ArrowDown}");
    expect(detailsScroll.scrollTop).toBeGreaterThan(0);
    const afterDown = detailsScroll.scrollTop;

    await user.keyboard("{ArrowUp}");
    expect(detailsScroll.scrollTop).toBeLessThan(afterDown);
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

    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Issue details" })).toHaveFocus(),
    );
  });

  it("renders a passed-review empty state when there are no issues", () => {
    renderView([]);

    expect(screen.getByText("No issues found")).toBeInTheDocument();
    expect(screen.getByText("No issues in this review")).toBeInTheDocument();
    expect(screen.getByText("This analysis passed without issues.")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("distinguishes filtered-out issues from passed reviews", async () => {
    const user = userEvent.setup();
    renderView([createReviewIssue("issue-1", "High issue", { severity: "high" })]);

    await user.click(screen.getByRole("button", { name: /low severity/i }));

    expect(screen.getByText(/No issues match the current filters/i)).toBeInTheDocument();
    expect(screen.getByText("No issues match this filter")).toBeInTheDocument();
    expect(screen.getByText("Choose another severity to continue.")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("toggles multiple severity filters and clears them via [Reset]", async () => {
    const user = userEvent.setup();
    renderView([
      createReviewIssue("issue-1", "High issue", { severity: "high" }),
      createReviewIssue("issue-2", "Medium issue", { severity: "medium" }),
      createReviewIssue("issue-3", "Low issue", { severity: "low" }),
    ]);

    const high = screen.getByRole("button", { name: /high severity/i });
    const medium = screen.getByRole("button", { name: /med severity/i });

    // The accessible name carries only severity + count; toggle state lives in
    // aria-pressed, never duplicated as a "selected"/"not selected" suffix.
    expect(high.getAttribute("aria-label")).not.toMatch(/selected/i);

    await user.click(high);
    expect(high).toHaveAttribute("aria-pressed", "true");
    expect(high.getAttribute("aria-label")).not.toMatch(/selected/i);
    await user.click(medium);
    expect(medium).toHaveAttribute("aria-pressed", "true");
    expect(high).toHaveAttribute("aria-pressed", "true");

    expect(screen.getAllByRole("option")).toHaveLength(2);

    const resetButton = screen.getByRole("button", { name: /reset severity filter/i });
    await user.click(resetButton);

    expect(high).toHaveAttribute("aria-pressed", "false");
    expect(medium).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByRole("option")).toHaveLength(3);

    const lastSeverityChip = screen.getByRole("button", { name: /nit severity/i });
    const filterGroup = screen.getByRole("group", { name: "Severity filter" });
    await waitFor(() => expect(lastSeverityChip).toHaveFocus());
    expect(filterGroup).toContainElement(document.activeElement as HTMLElement | null);
  });

  it("reaches Reset via ArrowRight from the last severity when filter is active", async () => {
    const user = userEvent.setup();
    renderView([createReviewIssue("issue-1", "High issue", { severity: "high" })]);

    await user.keyboard("{ArrowUp}");
    const filterGroup = screen.getByRole("group", { name: "Severity filter" });
    await waitFor(() =>
      expect(filterGroup).toContainElement(document.activeElement as HTMLElement | null),
    );

    await user.keyboard("{ArrowRight}");
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: /high severity/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
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
      createReviewIssue("issue-1", "High issue", { severity: "high" }),
      createReviewIssue("issue-2", "Low issue", { severity: "low" }),
    ]);

    await user.click(screen.getByRole("button", { name: /high severity/i }));

    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /reset severity filter/i })).toBeInTheDocument();

    await user.keyboard("r");

    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(2));
    expect(
      screen.queryByRole("button", { name: /reset severity filter/i }),
    ).not.toBeInTheDocument();
  });
});

describe("ReviewResultsView mobile pane-swap", () => {
  function reviewRow(container: HTMLElement): HTMLElement {
    const row = container.querySelector<HTMLElement>('[data-row="review"]');
    if (!row) throw new Error("Missing review pane row");
    return row;
  }

  it("shows the issue list first on mobile by default", () => {
    const { container } = renderView();

    expect(reviewRow(container)).toHaveAttribute("data-mobile-pane", "list");
  });

  it("opens the details pane first on mobile when initialIssueId targets an issue", () => {
    const { container } = render(
      <KeyboardProvider>
        <FooterProvider>
          <ReviewResultsView
            issues={[
              createReviewIssue("issue-1", "Issue one"),
              createReviewIssue("issue-2", "Issue two"),
            ]}
            reviewId="review-1"
            initialIssueId="issue-2"
          />
          <FooterView />
        </FooterProvider>
      </KeyboardProvider>,
    );

    expect(reviewRow(container)).toHaveAttribute("data-mobile-pane", "details");
    expect(screen.getByRole("region", { name: "Issue details" })).toHaveTextContent("Issue two");
  });

  it("swaps to details on selection and back to the list via the mobile back control", async () => {
    const user = userEvent.setup();
    const { container } = renderView();

    expect(reviewRow(container)).toHaveAttribute("data-mobile-pane", "list");

    await user.click(screen.getByRole("option", { name: /issue two/i }));
    expect(reviewRow(container)).toHaveAttribute("data-mobile-pane", "details");

    // The back control's accessible name is exactly "Issues" (the arrow is aria-hidden);
    // the severity chips read "… issues" so an /issues/i match would be ambiguous here.
    await user.click(screen.getByRole("button", { name: "Issues" }));
    expect(reviewRow(container)).toHaveAttribute("data-mobile-pane", "list");
  });

  it("reveals the details pane when ArrowRight moves keyboard focus into details", async () => {
    const user = userEvent.setup();
    const { container } = renderView();

    expect(reviewRow(container)).toHaveAttribute("data-mobile-pane", "list");

    screen.getByRole("listbox").focus();
    await user.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Issue details" })).toHaveFocus(),
    );

    // A hardware-keyboard zone move must flip the visible pane, not leave focus
    // on the display:none details pane.
    expect(reviewRow(container)).toHaveAttribute("data-mobile-pane", "details");
  });

  it("reveals the details pane when Tab cycles keyboard focus into details", async () => {
    const user = userEvent.setup();
    const { container } = renderView();

    await waitFor(() => expect(screen.getByRole("listbox")).toHaveFocus());
    expect(reviewRow(container)).toHaveAttribute("data-mobile-pane", "list");

    await user.keyboard("{Tab}");
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Issue details" })).toHaveFocus(),
    );

    expect(reviewRow(container)).toHaveAttribute("data-mobile-pane", "details");
  });

  it("restores the list pane when the keyboard leaves the details zone", async () => {
    const user = userEvent.setup();
    const { container } = renderView();

    const detailsTab = screen.getByRole("tab", { name: "Details" });
    await user.click(detailsTab);
    await waitFor(() => expect(detailsTab).toHaveFocus());
    expect(reviewRow(container)).toHaveAttribute("data-mobile-pane", "details");

    // ArrowLeft at the leftmost tab returns to the list zone; the visible pane follows.
    await user.keyboard("{ArrowLeft}");
    await waitFor(() => expect(screen.getByRole("listbox")).toHaveFocus());
    expect(reviewRow(container)).toHaveAttribute("data-mobile-pane", "list");
  });
});
