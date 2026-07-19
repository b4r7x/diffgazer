import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import {
  createInitialReviewState,
  type ReviewEvent,
  type ReviewState,
  reviewReducer,
} from "@diffgazer/core/review";
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

import { ActivityLog } from "./activity-log";
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
    events: [],
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

type ThinkingAgent = Extract<ReviewEvent, { type: "agent_thinking" }>["agent"];

function makeLogEvents(count: number, agent: ThinkingAgent = "detective"): ReviewEvent[] {
  return Array.from({ length: count }, (_, index) => ({
    type: "agent_thinking",
    agent,
    thought: `event-${index}`,
    timestamp: "2026-01-01T00:00:00.000Z",
  }));
}

function createTaggedLogState(events: readonly ReviewEvent[]): ReviewState {
  return events.reduce(
    (state, event) => reviewReducer(state, { type: "EVENT", event }),
    createInitialReviewState(),
  );
}

function appendLogEvent(state: ReviewState, event: ReviewEvent): ReviewState {
  return reviewReducer(state, { type: "EVENT", event });
}

function trackEventReads(events: ReviewEvent[]) {
  let readCount = 0;
  return {
    events: new Proxy(events, {
      get(target, property, receiver) {
        if (typeof property === "string" && /^\d+$/.test(property)) readCount += 1;
        return Reflect.get(target, property, receiver);
      },
    }) as readonly ReviewEvent[],
    getReadCount: () => readCount,
    resetReadCount: () => {
      readCount = 0;
    },
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
          errorCode={props.errorCode}
          reviewId={props.reviewId}
          onRetry={props.onRetry}
          onViewResults={props.onViewResults}
          onCancel={props.onCancel}
          onBack={props.onBack}
          cancelDisabled={props.cancelDisabled}
        />
        <FooterView />
      </FooterProvider>
    </KeyboardProvider>,
  );
}

describe("ReviewProgressView", () => {
  it.each([
    {
      errorCode: "MODEL_ERROR",
      message: "1 agent failed: Guardian. Results may be incomplete.",
    },
    {
      errorCode: "RATE_LIMITED",
      message: "1 agent failed (rate limited): Guardian. Results may be incomplete.",
    },
  ])("renders the warning classified by latest $errorCode lens stats", ({ errorCode, message }) => {
    renderView({
      data: makeProgressData({
        agents: [makeAgent({ status: "error" })],
        lensStats: [{ lensId: "security", issueCount: 0, status: "failed", errorCode }],
      }),
    });

    const status = screen.getByText("Partial Analysis").closest('[role="status"]');
    if (!status) throw new Error("Partial Analysis callout did not render as a live status region");
    expect(status).toHaveTextContent(message);
  });

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

  it("disables pending cancellation while keeping Back active", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onBack = vi.fn();

    renderView({ isRunning: true, onCancel, onBack, cancelDisabled: true });

    const cancel = await screen.findByRole("button", { name: "Cancel" });
    expect(cancel).toBeDisabled();

    await user.click(cancel);
    await user.keyboard("c");
    await user.keyboard("{Escape}");

    expect(onCancel).not.toHaveBeenCalled();
    expect(onBack).toHaveBeenCalledTimes(1);
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

  it("keeps prior activity visible and retries a dropped transport stream", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    renderView({
      isRunning: false,
      error: "Connection closed unexpectedly",
      errorCode: "STREAM_ERROR",
      reviewId: "active-review",
      onRetry,
      onBack: vi.fn(),
      data: makeProgressData({ events: makeLogEvents(2) }),
    });

    expect(screen.getByText("event-0")).toBeInTheDocument();
    expect(screen.getByText("event-1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledWith("active-review");
  });

  it("keeps API-key recovery pointed at provider settings without offering stream retry", () => {
    renderView({
      isRunning: false,
      error: "Credentials rejected",
      errorCode: "API_KEY_MISSING",
      reviewId: "active-review",
      onRetry: vi.fn(),
      onBack: vi.fn(),
      data: makeProgressData({ events: makeLogEvents(1) }),
    });

    expect(screen.getByText("event-0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Configure Provider" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
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

  it("bounds a 5,000-event log while Home and End retain full-history navigation", async () => {
    const user = userEvent.setup();
    renderView({
      isRunning: true,
      data: makeProgressData({ events: makeLogEvents(5_000) }),
    });

    const log = screen.getByRole("log");
    Object.defineProperty(log, "scrollHeight", { configurable: true, value: 1_000 });
    expect(screen.getByText("event-4999")).toBeInTheDocument();
    expect(screen.getAllByText(/^event-/)).toHaveLength(200);

    log.scrollTop = 1_000;
    log.focus();
    await user.keyboard("{Home}");
    await waitFor(() => expect(screen.getByText("event-0")).toBeInTheDocument());
    expect(log.scrollTop).toBe(0);
    expect(screen.queryByText("event-4999")).not.toBeInTheDocument();
    expect(screen.getAllByText(/^event-/)).toHaveLength(200);

    await user.keyboard("{End}");
    await waitFor(() => expect(screen.getByText("event-4999")).toBeInTheDocument());
    expect(log.scrollTop).toBe(1_000);
    expect(screen.queryByText("event-0")).not.toBeInTheDocument();
    expect(screen.getAllByText(/^event-/)).toHaveLength(200);
  });

  it("shows the oldest retained page when the paged-back window is fully evicted", async () => {
    const user = userEvent.setup();
    const events = makeLogEvents(5_000);
    let state = createTaggedLogState(events);
    const { rerender } = render(<ActivityLog events={state.events} />);
    const log = screen.getByRole("log");

    log.focus();
    await user.keyboard("{Home}");
    expect(screen.getByText("event-0")).toBeInTheDocument();

    for (let offset = 0; offset < 200; offset += 1) {
      state = appendLogEvent(state, {
        type: "agent_thinking",
        agent: "detective",
        thought: `event-${5_000 + offset}`,
        timestamp: "2026-01-01T00:00:00.000Z",
      });
    }
    rerender(<ActivityLog events={state.events} />);

    expect(screen.getByText("event-200")).toBeInTheDocument();
    expect(screen.getByText("event-399")).toBeInTheDocument();
    expect(screen.queryByText("event-400")).not.toBeInTheDocument();
    expect(screen.getAllByText(/^event-/)).toHaveLength(200);
  });

  it("keeps a full paged-back window after a partial ring eviction", async () => {
    const user = userEvent.setup();
    let state = createTaggedLogState(makeLogEvents(5_000));
    const { rerender } = render(<ActivityLog events={state.events} />);
    const log = screen.getByRole("log");

    log.focus();
    await user.keyboard("{Home}");
    expect(screen.getByText("event-0")).toBeInTheDocument();

    for (let offset = 0; offset < 50; offset += 1) {
      state = appendLogEvent(state, {
        type: "agent_thinking",
        agent: "detective",
        thought: `event-${5_000 + offset}`,
        timestamp: "2026-01-01T00:00:00.000Z",
      });
    }
    rerender(<ActivityLog events={state.events} />);

    expect(screen.getByText("event-50")).toBeInTheDocument();
    expect(screen.getByText("event-249")).toBeInTheDocument();
    expect(screen.queryByText("event-250")).not.toBeInTheDocument();
    expect(screen.getAllByText(/^event-/)).toHaveLength(200);
  });

  it("renders untagged reorder and reset replacements exactly with duplicate identities", () => {
    const event = (thought: string): ReviewEvent => ({
      type: "agent_thinking",
      agent: "detective",
      thought,
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    const first = event("order-first");
    const duplicate = event("order-duplicate");
    const alpha = event("order-alpha");
    const middle = event("order-middle");
    const omega = event("order-omega");
    const last = event("order-last");
    const { rerender } = render(
      <ActivityLog events={[first, duplicate, alpha, middle, duplicate, omega, last]} />,
    );

    rerender(<ActivityLog events={[first, duplicate, omega, middle, duplicate, alpha, last]} />);
    expect(screen.getAllByText(/^order-/).map((row) => row.textContent)).toEqual([
      "order-first",
      "order-duplicate",
      "order-omega",
      "order-middle",
      "order-duplicate",
      "order-alpha",
      "order-last",
    ]);

    rerender(
      <ActivityLog
        events={[
          first,
          event("order-new-a"),
          event("order-new-b"),
          middle,
          event("order-new-c"),
          event("order-new-d"),
          last,
        ]}
      />,
    );
    expect(screen.getAllByText(/^order-/).map((row) => row.textContent)).toEqual([
      "order-first",
      "order-new-a",
      "order-new-b",
      "order-middle",
      "order-new-c",
      "order-new-d",
      "order-last",
    ]);
  });

  it("keeps sparse agent matches reachable outside the unfiltered tail window", async () => {
    const user = userEvent.setup();
    const events = makeLogEvents(5_000, "guardian");
    events[0] = {
      type: "agent_thinking",
      agent: "detective",
      thought: "event-0-detective",
      timestamp: "2026-01-01T00:00:00.000Z",
    };
    const detective = makeAgent({
      id: "detective",
      meta: {
        id: "detective",
        lens: "correctness",
        name: "Detective",
        badgeLabel: "DET",
        badgeVariant: "info",
        description: "Finds bugs",
      },
    });

    renderView({
      isRunning: true,
      data: makeProgressData({ agents: [detective], events }),
    });

    await user.click(screen.getByRole("radio", { name: /Detective/ }));

    expect(screen.getByText("event-0-detective")).toBeInTheDocument();
    expect(screen.getAllByText(/^event-/)).toHaveLength(1);
  });

  it("indexes a sparse agent filter once and pages it without rescanning history", async () => {
    const user = userEvent.setup();
    const rawEvents = makeLogEvents(5_000, "guardian");
    for (let index = 9; index < rawEvents.length; index += 10) {
      rawEvents[index] = {
        type: "agent_thinking",
        agent: "detective",
        thought: `detective-${index}`,
        timestamp: "2026-01-01T00:00:00.000Z",
      };
    }
    const tracked = trackEventReads(rawEvents);
    render(<ActivityLog events={tracked.events} sourceFilter="Detective" />);
    const log = screen.getByRole("log");

    expect(screen.getByText("detective-4999")).toBeInTheDocument();
    expect(screen.getAllByText(/^detective-/)).toHaveLength(200);
    expect(tracked.getReadCount()).toBeLessThan(5_500);

    tracked.resetReadCount();
    log.focus();
    await user.keyboard("{Home}");
    expect(screen.getByText("detective-9")).toBeInTheDocument();
    expect(screen.getByText("detective-1999")).toBeInTheDocument();
    expect(tracked.getReadCount()).toBeLessThan(450);

    tracked.resetReadCount();
    await user.keyboard("{PageDown}");
    expect(screen.getByText("detective-2009")).toBeInTheDocument();
    expect(screen.getByText("detective-3999")).toBeInTheDocument();
    expect(tracked.getReadCount()).toBeLessThan(450);

    tracked.resetReadCount();
    await user.keyboard("{PageUp}");
    expect(screen.getByText("detective-9")).toBeInTheDocument();
    expect(tracked.getReadCount()).toBeLessThan(450);
  });

  it("autoscrolls after an appended tail row is mounted", async () => {
    const initialEvents = makeLogEvents(2);
    const { rerender } = render(<ActivityLog events={initialEvents} />);
    const log = screen.getByRole("log");
    Object.defineProperty(log, "scrollHeight", {
      configurable: true,
      get: () => (log.textContent?.includes("event-2") ? 300 : 200),
    });
    Object.defineProperty(log, "clientHeight", { configurable: true, value: 100 });
    log.scrollTop = 0;

    rerender(
      <ActivityLog
        events={[
          ...initialEvents,
          {
            type: "agent_thinking",
            agent: "detective",
            thought: "event-2",
            timestamp: "2026-01-01T00:00:00.000Z",
          },
        ]}
      />,
    );

    await waitFor(() => expect(log.scrollTop).toBe(300));
    expect(screen.getByText("event-2")).toBeInTheDocument();
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

  it("shows agent progress on the dedicated board without duplicating it under the workflow step", () => {
    renderView({
      isRunning: true,
      data: makeProgressData({
        steps: [
          { id: "parse", label: "Parse diff", status: "completed" },
          {
            id: "review",
            label: "Review",
            status: "active",
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
