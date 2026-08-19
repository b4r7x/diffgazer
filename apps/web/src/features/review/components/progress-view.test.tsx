import { FooterProvider } from "@diffgazer/core/footer";
import {
  createInitialReviewState,
  type ReviewEvent,
  type ReviewState,
  reviewReducer,
  sanitizePresentationText,
} from "@diffgazer/core/review";
import type { AgentState } from "@diffgazer/core/schemas/events";
import { KeyboardProvider } from "@diffgazer/keys";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FooterView } from "@/testing/footer-view";

// Boundary mock: TanStack Router is the external routing library; progress shortcuts navigate through it.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

import {
  type ReviewProgressData,
  ReviewProgressView,
  type ReviewProgressViewProps,
} from "./progress-view";

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

function makeLogEvent(index: number, agent: ThinkingAgent = "detective"): ReviewEvent {
  return {
    type: "agent_thinking",
    agent,
    thought: `event-${index}`,
    timestamp: "2026-01-01T00:00:00.000Z",
  };
}

function makeLogEvents(count: number, agent: ThinkingAgent = "detective"): ReviewEvent[] {
  return Array.from({ length: count }, (_, index) => makeLogEvent(index, agent));
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
          transportFamily={props.transportFamily}
          reviewId={props.reviewId}
          contextRefreshError={props.contextRefreshError}
          onRetryContextRefresh={props.onRetryContextRefresh}
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

  it("returns home from the error screen via Back to Home without cancelling", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onCancel = vi.fn();

    renderView({ isRunning: false, error: "Provider request failed", onBack, onCancel });

    await user.click(screen.getByRole("button", { name: "Back to Home" }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("announces stream errors in an alert live region", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    renderView({
      isRunning: false,
      error: "Provider request failed",
      onCancel: vi.fn(),
      onBack,
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveTextContent("Provider request failed");

    await user.keyboard("{Enter}");

    expect(alert).toHaveTextContent("Provider request failed");
    expect(onBack).not.toHaveBeenCalled();
  });

  it("sanitizes untrusted failure text before announcing it", () => {
    const leaky = "Bearer sk-live-secret-12345678 failed at /Users/me/secret";
    renderView({ isRunning: false, error: leaky, onCancel: vi.fn(), onBack: vi.fn() });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(sanitizePresentationText(leaky));
    expect(alert.textContent).not.toMatch(/sk-live-secret/i);
    expect(alert.textContent).not.toMatch(/Bearer\s+/i);
    expect(alert.textContent).not.toMatch(/\/Users\//);
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
      transportFamily: "hosted-api",
      reviewId: "active-review",
      onRetry: vi.fn(),
      onBack: vi.fn(),
      data: makeProgressData({ events: makeLogEvents(1) }),
    });

    expect(screen.getByText("event-0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Configure Provider" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it.each([
    {
      errorCode: "MODEL_INCOMPATIBLE",
      error: "Adapter response failed schema validation.",
      title: "Model Incompatible",
      cta: "Change model",
    },
    {
      errorCode: "PROVIDER_REJECTED",
      error: "Groq rejected the credential (HTTP 401).",
      title: "Provider Rejected the Request",
      cta: "Fix provider",
    },
  ])("offers the providers screen for a $errorCode failure", ({ errorCode, error, title, cta }) => {
    renderView({
      isRunning: false,
      error,
      errorCode,
      transportFamily: "hosted-api",
      reviewId: "active-review",
      onRetry: vi.fn(),
      onBack: vi.fn(),
    });

    expect(screen.getByRole("alert")).toHaveTextContent(title);
    expect(screen.getByRole("alert")).toHaveTextContent(error);
    expect(screen.getByRole("button", { name: cta })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("renders streamed server notices in a non-blocking live region", () => {
    renderView({
      isRunning: true,
      data: makeProgressData({
        notices: ["Event stream truncated: showing the first 500 events."],
      }),
    });

    const notice = screen.getByText("Event stream truncated: showing the first 500 events.");
    expect(notice).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toContain(notice.closest("output"));
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

  it("cycles pane focus with Tab from inside a pane", async () => {
    const user = userEvent.setup();
    renderView();

    const progressPane = screen.getByRole("region", { name: "Progress" });
    const logPane = screen.getByRole("region", { name: "Live Activity Log" });
    await waitFor(() => expect(progressPane).toHaveAttribute("data-state", "focused"));

    await user.keyboard("{Tab}");
    await waitFor(() => expect(logPane).toHaveAttribute("data-state", "focused"));
    expect(screen.getByRole("log")).toHaveFocus();
    expect(progressPane).not.toHaveAttribute("data-state", "focused");

    await user.keyboard("{Shift>}{Tab}{/Shift}");
    await waitFor(() => expect(progressPane).toHaveAttribute("data-state", "focused"));
    expect(logPane).not.toHaveAttribute("data-state", "focused");
    expect(progressPane.matches(":focus-within")).toBe(true);
  });

  it("leaves native Tab available while focus sits outside the panes", async () => {
    const user = userEvent.setup();
    renderView({ data: makeProgressData({ agents: [makeAgent()] }) });

    const progressPane = screen.getByRole("region", { name: "Progress" });
    await waitFor(() => expect(progressPane).toHaveAttribute("data-state", "focused"));

    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.body).toHaveFocus();

    // Outside every pane the cycle declines Tab, so controls rendered beside the
    // panes (app chrome, skip link) keep their keyboard path.
    await user.tab();

    expect(screen.getByRole("radio", { name: "All" })).toHaveFocus();
    expect(screen.getByRole("log")).not.toHaveFocus();
  });

  it("focuses the agent filter chips with f", async () => {
    const user = userEvent.setup();
    renderView({
      data: makeProgressData({ agents: [makeAgent()] }),
    });

    await user.keyboard("f");

    await waitFor(() => expect(screen.getByRole("radio", { name: "All" })).toHaveFocus());
    expect(screen.getByRole("region", { name: "Live Activity Log" })).toHaveAttribute(
      "data-state",
      "focused",
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
      expect(screen.getByRole("region", { name: "Progress" })).toHaveAttribute(
        "data-state",
        "focused",
      ),
    );
  });

  it("advertises the Filter shortcut while running", async () => {
    renderView({ isRunning: true, onCancel: vi.fn() });

    expect(await screen.findByText("Filter")).toBeInTheDocument();
    expect(screen.getByText("f")).toBeInTheDocument();
  });

  it("leaves native Tab available on the error screen", async () => {
    const user = userEvent.setup();
    renderView({
      isRunning: false,
      error: "API key error",
      transportFamily: "hosted-api",
      onBack: vi.fn(),
    });

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

  it("rests both panes once focus leaves them, instead of pinning the last active zone", async () => {
    renderView();

    const progressPane = screen.getByRole("region", { name: "Progress" });
    const logPane = screen.getByRole("region", { name: "Live Activity Log" });
    await waitFor(() => expect(progressPane).toHaveAttribute("data-state", "focused"));

    (document.activeElement as HTMLElement | null)?.blur();

    await waitFor(() => expect(progressPane).not.toHaveAttribute("data-state", "focused"));
    expect(logPane).not.toHaveAttribute("data-state", "focused");
  });

  it("marks the log pane focused when pointer focus lands inside it", async () => {
    const user = userEvent.setup();
    renderView();

    const logPane = screen.getByRole("region", { name: "Live Activity Log" });
    expect(logPane).not.toHaveAttribute("data-state", "focused");

    await user.click(screen.getByRole("radio", { name: "All" }));

    await waitFor(() => expect(logPane).toHaveAttribute("data-state", "focused"));
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

  it("shows a context refresh failure with retry instead of silently omitting the snapshot", async () => {
    const user = userEvent.setup();
    const onRetryContextRefresh = vi.fn();

    renderView({
      isRunning: false,
      contextRefreshError: "Failed to refresh the review context snapshot.",
      onRetryContextRefresh,
    });

    const status = screen.getByText("Context snapshot unavailable").closest('[role="status"]');
    if (!status) {
      throw new Error("Context refresh callout did not render as a live status region");
    }
    expect(status).toHaveTextContent("Failed to refresh the review context snapshot.");

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetryContextRefresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Context Snapshot")).not.toBeInTheDocument();
  });

  it("prefers the loaded context snapshot over a cleared refresh error", () => {
    renderView({
      isRunning: false,
      contextRefreshError: null,
      data: makeProgressData({
        contextSnapshot: {
          text: "context",
          markdown: "# Context",
          graph: {
            generatedAt: "2026-01-01T00:00:00.000Z",
            root: "/repo",
            packages: [],
            edges: [],
            fileTree: [],
            changedFiles: [],
          },
          meta: {
            generatedAt: "2026-01-01T00:00:00.000Z",
            root: "/repo",
            statusHash: "hash",
            statusHashKind: "full",
            charCount: 7,
          },
        },
      }),
    });

    expect(screen.getByText("Context Snapshot")).toBeInTheDocument();
    expect(screen.queryByText("Context snapshot unavailable")).not.toBeInTheDocument();
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

describe("ReviewProgressView elapsed clock", () => {
  it("prints the same second in the metrics timer and in the pinned tail row", () => {
    vi.useFakeTimers();
    try {
      renderView({
        isRunning: true,
        data: makeProgressData({
          agents: [makeAgent()],
          events: makeLogEvents(1),
          startTime: new Date(Date.now() - 46_500),
        }),
      });

      // Between two whole seconds: two clocks with their own intervals report
      // different seconds here, one shared clock reports the same one twice.
      act(() => vi.advanceTimersByTime(600));

      expect(screen.getByText("00:46")).toBeVisible();
      expect(screen.getByText(/waiting for model response · 46\.5s$/)).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("ReviewProgressView stream liveness", () => {
  function renderRunning(onRetry?: (reviewId: string) => void) {
    return renderView({
      isRunning: true,
      reviewId: "review-1",
      onRetry,
      data: makeProgressData({ agents: [makeAgent()], events: makeLogEvents(1) }),
    });
  }

  function renderStream(initialEvents: readonly ReviewEvent[]) {
    const tree = (events: readonly ReviewEvent[]) => (
      <KeyboardProvider>
        <FooterProvider>
          <ReviewProgressView
            data={makeProgressData({ agents: [makeAgent()], events })}
            isRunning
          />
        </FooterProvider>
      </KeyboardProvider>
    );
    const { rerender } = render(tree(initialEvents));
    return { push: (events: readonly ReviewEvent[]) => rerender(tree(events)) };
  }

  /** Appends until the capped event buffer stops growing, as a long run does. */
  function fillEventBuffer(): ReviewState {
    let state = createInitialReviewState();
    let previousLength = -1;
    let index = 0;
    while (state.events.length !== previousLength) {
      previousLength = state.events.length;
      state = reviewReducer(state, { type: "EVENT", event: makeLogEvent(index) });
      index += 1;
    }
    return state;
  }

  it("never calls a stall on a stream that keeps delivering events", () => {
    vi.useFakeTimers();
    try {
      let state = reviewReducer(createInitialReviewState(), {
        type: "EVENT",
        event: makeLogEvent(0),
      });
      const stream = renderStream(state.events);

      for (let tick = 1; tick <= 12; tick += 1) {
        act(() => vi.advanceTimersByTime(5_000));
        state = reviewReducer(state, { type: "EVENT", event: makeLogEvent(tick) });
        stream.push(state.events);
      }

      expect(screen.queryByText(/Stream quiet/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Stream stalled/)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("never calls a stall once the event buffer is full and events still arrive", () => {
    vi.useFakeTimers();
    try {
      let state = fillEventBuffer();
      const cappedLength = state.events.length;
      const stream = renderStream(state.events);

      for (let tick = 1; tick <= 12; tick += 1) {
        act(() => vi.advanceTimersByTime(5_000));
        state = reviewReducer(state, {
          type: "EVENT",
          event: makeLogEvent(cappedLength + tick),
        });
        stream.push(state.events);
      }

      expect(state.events).toHaveLength(cappedLength);
      expect(screen.queryByText(/Stream quiet/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Stream stalled/)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stays quiet while events flow", () => {
    vi.useFakeTimers();
    try {
      renderRunning();

      act(() => vi.advanceTimersByTime(10_000));

      expect(screen.queryByText(/Stream quiet/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Stream stalled/)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("names the silence at 20s and calls it a stall at 45s", () => {
    vi.useFakeTimers();
    try {
      renderRunning(vi.fn());

      act(() => vi.advanceTimersByTime(21_000));
      expect(screen.getByText(/Stream quiet/)).toBeVisible();
      expect(screen.queryByRole("button", { name: "Reconnect" })).not.toBeInTheDocument();

      act(() => vi.advanceTimersByTime(25_000));
      expect(screen.getByText(/Stream stalled/)).toBeVisible();
      expect(screen.getByRole("button", { name: "Reconnect" })).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });

  it("resubscribes the stream from the stalled state", async () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    try {
      renderRunning(onRetry);
      act(() => vi.advanceTimersByTime(46_000));

      // fireEvent retained: fake timers drive the stall clock; userEvent waits on the same timer queue.
      fireEvent.click(screen.getByRole("button", { name: "Reconnect" }));
    } finally {
      vi.useRealTimers();
    }

    expect(onRetry).toHaveBeenCalledWith("review-1");
  });

  it("says nothing about liveness once the run is finished", () => {
    vi.useFakeTimers();
    try {
      renderView({
        isRunning: false,
        data: makeProgressData({ agents: [makeAgent({ status: "complete", progress: 100 })] }),
      });

      act(() => vi.advanceTimersByTime(60_000));

      expect(screen.queryByText(/Stream stalled/)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
