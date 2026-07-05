import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import type { AgentState } from "@diffgazer/core/schemas/events";
import { KeyboardProvider } from "@diffgazer/keys";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Footer } from "@/components/layout/footer";

// Boundary mock: TanStack Router is the external routing library; progress shortcuts navigate through it.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

import {
  type ReviewProgressData,
  ReviewProgressView,
  type ReviewProgressViewProps,
} from "./progress-view";

function FooterView() {
  const { shortcuts, rightShortcuts } = useFooterData();
  return <Footer shortcuts={shortcuts} rightShortcuts={rightShortcuts} />;
}

function makeAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    id: "guardian",
    meta: {
      id: "guardian",
      lens: "security",
      name: "Guardian",
      badgeLabel: "SEC",
      badgeVariant: "warning",
      description: "",
    },
    status: "running",
    progress: 40,
    issueCount: 0,
    ...overrides,
  };
}

function makeProgressData(overrides: Partial<ReviewProgressData> = {}): ReviewProgressData {
  return {
    steps: [{ id: "parse", label: "Parse diff", status: "completed" }],
    entries: [],
    agents: [],
    metrics: {
      filesProcessed: 0,
      filesTotal: 0,
      issuesFound: 0,
    },
    notices: [],
    ...overrides,
  };
}

function renderView(props: Partial<ReviewProgressViewProps> = {}) {
  return render(
    <KeyboardProvider>
      <FooterProvider>
        <ReviewProgressView
          data={props.data ?? makeProgressData()}
          isRunning={props.isRunning ?? false}
          error={props.error}
          onViewResults={props.onViewResults}
          onCancel={props.onCancel}
          onBack={props.onBack}
        />
        <FooterView />
      </FooterProvider>
    </KeyboardProvider>,
  );
}

describe("ReviewProgressView", () => {
  it("publishes only available progress shortcuts", async () => {
    renderView();

    expect(await screen.findAllByText("Switch Pane")).toHaveLength(2);
    expect(screen.getByText("Tab")).toBeInTheDocument();
    expect(screen.getByText("←/→")).toBeInTheDocument();
    expect(screen.queryByText("View Results")).not.toBeInTheDocument();
    expect(screen.queryByText("Back")).not.toBeInTheDocument();
  });

  it("omits View Results shortcut when onViewResults is not provided", async () => {
    renderView({ isRunning: true, onCancel: vi.fn() });

    expect(await screen.findByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View Results" })).not.toBeInTheDocument();
  });

  it("renders a clickable Cancel button while streaming so pointer users can stop a review", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    renderView({ isRunning: true, onCancel });

    const cancel = await screen.findByRole("button", { name: "Cancel" });
    await user.click(cancel);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("cancels the run with c while running", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    renderView({ isRunning: true, onCancel });

    await user.keyboard("c");

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not cancel with c when focus is on a button", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    renderView({ isRunning: true, onCancel });

    const cancel = await screen.findByRole("button", { name: "Cancel" });
    cancel.focus();

    await user.keyboard("c");

    expect(onCancel).not.toHaveBeenCalled();
  });

  it("renders a clickable View Results button after completion", async () => {
    const user = userEvent.setup();
    const onViewResults = vi.fn();

    renderView({ isRunning: false, onViewResults });

    const viewResults = await screen.findByRole("button", { name: "View Results" });
    await user.click(viewResults);

    expect(onViewResults).toHaveBeenCalledTimes(1);
  });

  it("does not render the streaming Cancel button once the review is no longer running", () => {
    renderView({ isRunning: false, onViewResults: vi.fn(), onCancel: vi.fn() });

    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("ignores c when the run is not active", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    renderView({ isRunning: false, onCancel });

    await user.keyboard("c");

    expect(onCancel).not.toHaveBeenCalled();
  });

  it("announces the mid-run partial-analysis warning when it appears", () => {
    renderView({
      isRunning: true,
      error: null,
      data: makeProgressData({
        agents: [makeAgent({ status: "error", progress: 100 })],
      }),
      onCancel: vi.fn(),
    });

    // The Partial Analysis Callout announces on appear via a live status region (F-353c).
    const status = screen.getByText("Partial Analysis").closest('[role="status"]');
    if (!status) throw new Error("Partial Analysis callout did not render as a live status region");
    expect(status).toHaveTextContent("Partial Analysis");
  });

  it("Enter does not fire onViewResults when it is not provided", async () => {
    const user = userEvent.setup();
    const onViewResults = vi.fn();

    // Simulate error state: not running, error present, no onViewResults provided
    renderView({ isRunning: false, error: "API key error", onBack: vi.fn() });

    await screen.findByText("Back");
    await user.keyboard("{Enter}");

    expect(onViewResults).not.toHaveBeenCalled();
  });

  it("returns home from the error screen via Back to Home without cancelling", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onCancel = vi.fn();

    renderView({ isRunning: false, error: "Provider request failed", onBack, onCancel });

    await user.click(screen.getByRole("button", { name: "Back to Home" }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("announces stream errors in an alert live region", () => {
    renderView({ isRunning: false, error: "Provider request failed", onCancel: vi.fn() });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveTextContent("Provider request failed");
  });

  it("renders streamed server notices in a non-blocking live region", () => {
    renderView({
      isRunning: true,
      data: makeProgressData({
        notices: ["Event stream truncated: showing the first 500 events."],
      }),
    });

    expect(
      screen.getByText("Event stream truncated: showing the first 500 events."),
    ).toBeInTheDocument();
  });

  it("exposes the progress and live activity log panes as named regions", () => {
    renderView();

    expect(screen.getByRole("region", { name: "Progress" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Live Activity Log" })).toBeInTheDocument();
  });

  it("cycles pane focus with Tab from anywhere in the document", async () => {
    const user = userEvent.setup();
    renderView();

    const progressPane = screen.getByRole("region", { name: "Progress" });
    const logPane = screen.getByRole("region", { name: "Live Activity Log" });
    await waitFor(() => expect(progressPane).toHaveAttribute("data-focused"));

    // Move focus outside both pane containers; document-scope Tab must still cycle.
    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.body).toHaveFocus();

    await user.keyboard("{Tab}");
    await waitFor(() => expect(logPane).toHaveAttribute("data-focused"));
    expect(screen.getByRole("log")).toHaveFocus();
    expect(progressPane).not.toHaveAttribute("data-focused");

    await user.keyboard("{Shift>}{Tab}{/Shift}");
    await waitFor(() => expect(progressPane).toHaveAttribute("data-focused"));
    expect(logPane).not.toHaveAttribute("data-focused");
    expect(progressPane.matches(":focus-within")).toBe(true);
  });

  it("focuses the agent filter chips with f", async () => {
    const user = userEvent.setup();
    renderView({
      data: makeProgressData({ agents: [makeAgent()] }),
    });

    await user.keyboard("f");

    await waitFor(() => expect(screen.getByRole("radio", { name: "All" })).toHaveFocus());
    expect(screen.getByRole("region", { name: "Live Activity Log" })).toHaveAttribute(
      "data-focused",
    );
  });

  it("returns to the pane cycle with Tab from the agent filters", async () => {
    const user = userEvent.setup();
    renderView({
      data: makeProgressData({ agents: [makeAgent()] }),
    });

    await user.keyboard("f");
    await waitFor(() => expect(screen.getByRole("radio", { name: "All" })).toHaveFocus());

    await user.keyboard("{Tab}");

    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Progress" })).toHaveAttribute("data-focused"),
    );
  });

  it("advertises the Filter shortcut while running", async () => {
    renderView({ isRunning: true, onCancel: vi.fn() });

    expect(await screen.findByText("Filter")).toBeInTheDocument();
    expect(screen.getByText("f")).toBeInTheDocument();
  });

  it("leaves native Tab available on the error screen", async () => {
    const user = userEvent.setup();
    renderView({ isRunning: false, error: "API key error", onBack: vi.fn() });

    const back = await screen.findByRole("button", { name: "Back to Home" });
    const configure = screen.getByRole("button", { name: "Configure Provider" });
    back.focus();

    // fireEvent retained: low-level Tab dispatch asserts the error state does not prevent native Tab.
    const prevented = !fireEvent.keyDown(back, { key: "Tab", code: "Tab" });
    expect(prevented).toBe(false);

    await user.tab();
    expect(configure).toHaveFocus();
  });

  it("does not advertise pane switching on the error screen", async () => {
    renderView({ isRunning: false, error: "Provider request failed", onBack: vi.fn() });

    expect(await screen.findByRole("button", { name: "Back to Home" })).toBeInTheDocument();
    expect(screen.queryByText("Switch Pane")).not.toBeInTheDocument();
  });

  it("fires onViewResults with Enter while the log scroll area has focus", async () => {
    const user = userEvent.setup();
    const onViewResults = vi.fn();

    renderView({ isRunning: false, onViewResults });

    await user.keyboard("{Tab}");
    await waitFor(() => expect(screen.getByRole("log")).toHaveFocus());

    await user.keyboard("{Enter}");

    expect(onViewResults).toHaveBeenCalledTimes(1);
  });

  it("marks the log pane focused when pointer focus lands inside it", async () => {
    const user = userEvent.setup();
    renderView();

    const logPane = screen.getByRole("region", { name: "Live Activity Log" });
    expect(logPane).not.toHaveAttribute("data-focused");

    await user.click(screen.getByRole("radio", { name: "All" }));

    await waitFor(() => expect(logPane).toHaveAttribute("data-focused"));
  });

  it("shows agents once on the agent board instead of expandable step substeps", () => {
    renderView({
      isRunning: true,
      data: makeProgressData({
        steps: [
          { id: "parse", label: "Parse diff", status: "completed" },
          {
            id: "review",
            label: "Review",
            status: "active",
            substeps: [{ id: "guardian", tag: "SEC", label: "Guardian", status: "active" }],
          },
        ],
        agents: [makeAgent()],
      }),
    });

    expect(screen.getByRole("progressbar", { name: "Guardian progress" })).toBeInTheDocument();
    const reviewStep = screen.getByRole("button", { name: /Review/ });
    expect(reviewStep).toBeDisabled();
    expect(reviewStep).not.toHaveAttribute("aria-expanded");
  });

  it("runs progress shortcuts when result and back actions are available", async () => {
    const user = userEvent.setup();
    const onViewResults = vi.fn();
    const onCancel = vi.fn();
    const onBack = vi.fn();

    renderView({ isRunning: true, onViewResults, onCancel, onBack });

    expect(await screen.findByRole("button", { name: "View Results" })).toBeInTheDocument();
    expect(screen.getByText("Back")).toBeInTheDocument();

    await user.keyboard("{Enter}");
    await user.keyboard("{Escape}");

    // call-count IS the contract: each shortcut keypress must fire its handler exactly once (no double-fire across the Enter+Escape sequence)
    expect(onViewResults).toHaveBeenCalledTimes(1);
    // call-count IS the contract: each shortcut keypress must fire its handler exactly once
    expect(onBack).toHaveBeenCalledTimes(1);
    // Escape must never cancel the run; only the visible [Cancel] button does.
    expect(onCancel).not.toHaveBeenCalled();
  });
});
