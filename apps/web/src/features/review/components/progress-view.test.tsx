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
import {
  act,
  fireEvent,
  type RenderOptions,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { FooterView } from "@/testing/footer-view";
import { HeaderChromeHarness } from "@/testing/header-chrome";
import { expectSingleReticle } from "@/testing/reticle";
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

function makeDetective(): AgentState {
  return makeAgent({
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

function makeContextSnapshot() {
  return {
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
      statusHashKind: "full" as const,
      charCount: 7,
    },
  };
}

function renderView(props: Partial<ReviewProgressViewProps> = {}, options?: RenderOptions) {
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
    options,
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

  it("announces a large-diff run and names the way to narrow it while it reads", () => {
    renderView({
      isRunning: true,
      data: makeProgressData({
        sizeWarning: {
          message: "This diff is about 180000 tokens against a 200000 token window.",
          diffBytes: 720_000,
          estimatedInputTokens: 180_000,
          contextTokens: 200_000,
          modelId: "openrouter/test-model",
        },
      }),
    });

    const callout = screen.getByText("Large Review").closest('[role="status"]');
    if (!callout) throw new Error("size warning did not render as a live status region");
    expect(callout).toHaveTextContent(
      "This diff is about 180000 tokens against a 200000 token window.",
    );
    expect(callout).toHaveTextContent("Review Scope");
  });

  it("drops the narrowing line once the run has finished", () => {
    renderView({
      isRunning: false,
      data: makeProgressData({
        sizeWarning: {
          message: "Large diff.",
          diffBytes: 1,
          estimatedInputTokens: 1,
          contextTokens: null,
          modelId: null,
        },
      }),
    });

    // There are results to read now; narrowing would throw them away.
    expect(screen.getByText("Large Review")).toBeInTheDocument();
    expect(screen.queryByText(/Review Scope/)).not.toBeInTheDocument();
  });

  it("stands the size advisory down while the run has a failure to report", () => {
    renderView({
      isRunning: false,
      error: "Stream disconnected",
      data: makeProgressData({
        sizeWarning: {
          message: "Large diff.",
          diffBytes: 1,
          estimatedInputTokens: 1,
          contextTokens: null,
          modelId: null,
        },
      }),
    });

    expect(screen.queryByText("Large Review")).not.toBeInTheDocument();
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

  // q cancels through the global quit interception while streaming, so the
  // footer teaches both keys together.
  it("advertises c/q Cancel in the footer while streaming", () => {
    renderView({ isRunning: true, onCancel: vi.fn() });

    const hint = screen.getByText("c/q");
    expect(hint.parentElement).toHaveTextContent("Cancel");
  });

  it("drops the Cancel hint while a cancel is pending", () => {
    renderView({ isRunning: true, onCancel: vi.fn(), cancelDisabled: true });

    expect(screen.queryByText("c/q")).not.toBeInTheDocument();
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

    // The Partial Analysis Callout announces on appear via a live status region.
    const status = screen.getByText("Partial Analysis").closest('[role="status"]');
    if (!status) throw new Error("Partial Analysis callout did not render as a live status region");
    expect(status).toHaveTextContent("1 agent failed");
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

  it("activates the focused error action with Enter while the alert keeps announcing", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onCancel = vi.fn();

    renderView({ isRunning: false, error: "Provider request failed", onCancel, onBack });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveTextContent("Provider request failed");
    await waitFor(() => expect(screen.getByRole("button", { name: "Back to Home" })).toHaveFocus());

    await user.keyboard("{Enter}");

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(alert).toHaveTextContent("Provider request failed");
  });

  it("focuses the first error action on mount and brackets the log pane", async () => {
    const { container } = renderView({
      isRunning: false,
      error: "Provider request failed",
      onBack: vi.fn(),
    });

    const back = screen.getByRole("button", { name: /back to home/i });
    await waitFor(() => expect(back).toHaveFocus());
    expect(back).toHaveAttribute("data-highlighted");
    expect(screen.getByRole("region", { name: "Live Activity Log" })).toHaveAttribute(
      "data-state",
      "focused",
    );
    expectSingleReticle(container);

    const log = screen.getByRole("log", { name: "Activity log" });
    expect(log).toHaveAttribute("tabindex", "-1");
    expect(log).not.toHaveFocus();
  });

  it("carries focus into the error row when a running review fails under it", async () => {
    const tree = (props: Partial<ReviewProgressViewProps>) => (
      <KeyboardProvider>
        <FooterProvider>
          <ReviewProgressView data={makeProgressData()} isRunning {...props} />
          <FooterView />
        </FooterProvider>
      </KeyboardProvider>
    );

    const { rerender } = render(tree({ onCancel: vi.fn(), onBack: vi.fn() }));
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Progress" })).toHaveAttribute(
        "data-state",
        "focused",
      ),
    );

    rerender(tree({ onBack: vi.fn(), error: "Provider request failed" }));

    const back = await screen.findByRole("button", { name: "Back to Home" });
    await waitFor(() => expect(back).toHaveFocus());
    expect(back).toHaveAttribute("data-highlighted");
  });

  it("hands the arrow up to the header Back and returns to the action it left", async () => {
    const user = userEvent.setup();
    const { container } = renderView(
      { isRunning: false, error: "Provider request failed", onBack: vi.fn() },
      { wrapper: HeaderChromeHarness },
    );

    const back = screen.getByRole("button", { name: "Back to Home" });
    await waitFor(() => expect(back).toHaveFocus());

    await user.keyboard("{ArrowUp}");

    expect(screen.getByRole("button", { name: "Back" })).toHaveFocus();
    expect(container.querySelector("[data-highlighted]")).toBeNull();
    expect(screen.getByText("↓").parentElement).toHaveTextContent("Actions");

    await user.keyboard("{ArrowDown}");

    await waitFor(() => expect(back).toHaveFocus());
    expect(back).toHaveAttribute("data-highlighted");
    expect(screen.queryByText("↓")).not.toBeInTheDocument();
    expectSingleReticle(container);
  });

  it("cycles Tab between the error actions and the log, skipping the lone All chip", async () => {
    const user = userEvent.setup();
    renderView({
      isRunning: false,
      error: "API key error",
      transportFamily: "hosted-api",
      onBack: vi.fn(),
    });

    const back = screen.getByRole("button", { name: "Back to Home" });
    const log = screen.getByRole("log", { name: "Activity log" });
    await waitFor(() => expect(back).toHaveFocus());

    await user.tab();
    expect(log).toHaveFocus();
    expect(back).not.toHaveAttribute("data-highlighted");
    expect(screen.queryByText("Move Action")).not.toBeInTheDocument();

    await user.tab({ shift: true });
    expect(back).toHaveFocus();
    expect(screen.getByRole("radio", { name: "All" })).not.toHaveFocus();

    // Outside the panes the cycle declines Tab, so controls rendered beside them
    // keep their native keyboard path.
    (document.activeElement as HTMLElement | null)?.blur();
    // fireEvent retained: low-level Tab dispatch asserts the error layout does not prevent native Tab.
    const prevented = !fireEvent.keyDown(document.body, { key: "Tab", code: "Tab" });
    expect(prevented).toBe(false);
  });

  it("enters the log with the down arrow and returns to the error actions at its top", async () => {
    const user = userEvent.setup();
    renderView({
      isRunning: false,
      error: "Provider request failed",
      onBack: vi.fn(),
      data: makeProgressData({ events: makeLogEvents(2) }),
    });

    const log = screen.getByRole("log", { name: "Activity log" });
    const back = screen.getByRole("button", { name: "Back to Home" });
    await waitFor(() => expect(back).toHaveFocus());

    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(log).toHaveFocus());

    log.scrollTop = 120;
    await user.keyboard("{ArrowUp}");
    expect(log).toHaveFocus();

    log.scrollTop = 0;
    await user.keyboard("{ArrowUp}");
    await waitFor(() => expect(back).toHaveFocus());
    expect(back).toHaveAttribute("data-highlighted");
  });

  it("names the focused error action in the footer, with no move for a lone one", async () => {
    renderView({ isRunning: false, error: "Provider request failed", onBack: vi.fn() });

    const enter = await screen.findByText("Enter/Space");
    expect(enter.parentElement).toHaveTextContent("Back to Home");
    expect(screen.queryByText("Move Action")).not.toBeInTheDocument();
    expect(screen.getByText("Esc").parentElement).toHaveTextContent("Back");
  });

  it("offers Move Action in the error footer once there is a second way out", async () => {
    renderView({
      isRunning: false,
      error: "Connection closed unexpectedly",
      errorCode: "STREAM_ERROR",
      reviewId: "active-review",
      onRetry: vi.fn(),
      onBack: vi.fn(),
    });

    expect(await screen.findByText("Move Action")).toBeInTheDocument();
    expect(screen.getByText("Enter/Space").parentElement).toHaveTextContent("Back to Home");
    expect(screen.getByText("Esc").parentElement).toHaveTextContent("Back");
  });

  it("offers no retry action for a failure the stream cannot pick back up", async () => {
    const onRetry = vi.fn();
    renderView({
      isRunning: false,
      error: "Provider rejected the request",
      errorCode: "PROVIDER_REJECTED",
      reviewId: "active-review",
      onRetry,
      onBack: vi.fn(),
    });

    // Only a dropped transport can be reconnected: every other failure leaves
    // Home as the single way out.
    expect(await screen.findByRole("button", { name: "Back to Home" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fix provider" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.queryByText("Move Action")).not.toBeInTheDocument();
    expect(onRetry).not.toHaveBeenCalled();
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

  it("leaves provider repair to the gate card instead of offering it inline", () => {
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
    // Only a dropped transport still runs under this panel, so the row keeps
    // the way home and nothing else; every other failure took the whole frame.
    expect(screen.queryByRole("button", { name: "Configure Provider" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to Home" })).toBeInTheDocument();
  });

  it("steps the transport row between home and the reconnect without leaving the panel", async () => {
    const user = userEvent.setup();
    renderView({
      isRunning: false,
      error: "Connection closed unexpectedly",
      errorCode: "STREAM_ERROR",
      reviewId: "active-review",
      onRetry: vi.fn(),
      onBack: vi.fn(),
    });

    const back = screen.getByRole("button", { name: "Back to Home" });
    const retry = screen.getByRole("button", { name: "Retry" });

    await waitFor(() => expect(back).toHaveFocus());
    expect(back).toHaveAttribute("data-highlighted");
    expect(screen.getByText("Move Action")).toBeInTheDocument();

    await user.keyboard("{ArrowRight}");
    expect(retry).toHaveFocus();
    expect(retry).toHaveAttribute("data-highlighted");
    expect(back).not.toHaveAttribute("data-highlighted");

    await user.keyboard("{ArrowLeft}");
    expect(back).toHaveFocus();

    // The end of the row is the end of the move: no pane sits left of the
    // error panel for the arrow to switch to.
    await user.keyboard("{ArrowLeft}");
    expect(back).toHaveFocus();
    expect(screen.getByRole("region", { name: "Live Activity Log" })).toHaveAttribute(
      "data-state",
      "focused",
    );
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

    renderView({
      isRunning: true,
      data: makeProgressData({ agents: [makeDetective()], events }),
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

  it("enters the log pane on the log region, never the chip row, with Tab from the agent filters", async () => {
    const user = userEvent.setup();
    renderView({
      data: makeProgressData({ agents: [makeAgent()] }),
    });

    await user.keyboard("f");
    const allChip = screen.getByRole("radio", { name: "All" });
    await waitFor(() => expect(allChip).toHaveFocus());

    // The chips sit above the log, so the cycle continues down into it instead
    // of falling back to the top of the cycle.
    await user.keyboard("{Tab}");
    await waitFor(() => expect(screen.getByRole("log")).toHaveFocus());

    await user.keyboard("{Shift>}{Tab}{/Shift}");
    await waitFor(() => expect(allChip).toHaveFocus());
  });

  it("leaves the chip row's ArrowUp hand-off a safe no-op when no chrome is mounted", async () => {
    const user = userEvent.setup();
    renderView({ data: makeProgressData({ agents: [makeAgent()] }) });

    await user.keyboard("f");
    const allChip = screen.getByRole("radio", { name: "All" });
    await waitFor(() => expect(allChip).toHaveFocus());

    // With a header the hand-off lands on Back; without one there is nothing to
    // hand to, and the chips must not absorb the key as a horizontal move.
    await user.keyboard("{ArrowUp}");
    expect(allChip).toHaveFocus();
    expect(allChip).toBeChecked();
  });

  it("moves from the agent chips into the log with ArrowDown", async () => {
    const user = userEvent.setup();
    renderView({ data: makeProgressData({ agents: [makeAgent()] }) });

    await user.keyboard("f");
    await waitFor(() => expect(screen.getByRole("radio", { name: "All" })).toHaveFocus());

    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(screen.getByRole("log")).toHaveFocus());
  });

  it("walks Tab from the pane through the actions and the agent chips into the log", async () => {
    const user = userEvent.setup();
    const { container } = renderView({
      isRunning: true,
      onCancel: vi.fn(),
      data: makeProgressData({ agents: [makeDetective()] }),
    });

    const progressPane = screen.getByRole("region", { name: "Progress" });
    const logPane = screen.getByRole("region", { name: "Live Activity Log" });
    await waitFor(() => expect(progressPane).toHaveAttribute("data-state", "focused"));

    await user.keyboard("{Tab}");
    const cancel = screen.getByRole("button", { name: "Cancel" });
    await waitFor(() => expect(cancel).toHaveFocus());
    expectSingleReticle(container);

    // The chip row is one stop, entered on the checked chip.
    await user.keyboard("{Tab}");
    const allChip = screen.getByRole("radio", { name: "All" });
    await waitFor(() => expect(allChip).toHaveFocus());
    expect(allChip).toHaveAttribute("aria-checked", "true");
    expect(logPane).toHaveAttribute("data-state", "focused");
    expectSingleReticle(container);

    await user.keyboard("{Tab}");
    await waitFor(() => expect(screen.getByRole("log")).toHaveFocus());
    expectSingleReticle(container);

    await user.keyboard("{Tab}");
    await waitFor(() => expect(progressPane).toHaveAttribute("data-state", "focused"));
    expectSingleReticle(container);

    await user.keyboard("{Shift>}{Tab}{/Shift}");
    await waitFor(() => expect(screen.getByRole("log")).toHaveFocus());

    await user.keyboard("{Shift>}{Tab}{/Shift}");
    await waitFor(() => expect(allChip).toHaveFocus());

    await user.keyboard("{Shift>}{Tab}{/Shift}");
    await waitFor(() => expect(cancel).toHaveFocus());
  });

  it("keeps the lone All chip out of the Tab cycle when the run has no agents", async () => {
    const user = userEvent.setup();
    renderView({ isRunning: true, onCancel: vi.fn() });

    const progressPane = screen.getByRole("region", { name: "Progress" });
    await waitFor(() => expect(progressPane).toHaveAttribute("data-state", "focused"));

    await user.keyboard("{Tab}");
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());

    const log = screen.getByRole("log");
    await user.keyboard("{Tab}");
    await waitFor(() => expect(log).toHaveFocus());
    expect(screen.getByRole("radio", { name: "All" })).not.toHaveFocus();

    // The accelerator stands down with the stop it opens.
    await user.keyboard("f");
    expect(log).toHaveFocus();
  });

  it("enters the agent chips on the checked one, from the actions row and from f", async () => {
    const user = userEvent.setup();
    renderView({
      isRunning: true,
      onCancel: vi.fn(),
      data: makeProgressData({ agents: [makeDetective()] }),
    });

    const detective = screen.getByRole("radio", { name: /Detective/ });
    await user.click(detective);
    expect(detective).toHaveAttribute("aria-checked", "true");

    // Round the cycle back to the chip row: log, progress, actions, chips.
    await user.keyboard("{Tab}");
    await waitFor(() => expect(screen.getByRole("log")).toHaveFocus());
    await user.keyboard("{Tab}");
    await user.keyboard("{Tab}");
    const cancel = screen.getByRole("button", { name: "Cancel" });
    await waitFor(() => expect(cancel).toHaveFocus());

    await user.keyboard("{Tab}");
    await waitFor(() => expect(detective).toHaveFocus());
    expect(screen.getByRole("radio", { name: "All" })).not.toHaveFocus();

    // The accelerator lands on the same chip from the other pane.
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    await waitFor(() => expect(cancel).toHaveFocus());
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Progress" })).toHaveAttribute(
        "data-state",
        "focused",
      ),
    );

    await user.keyboard("f");
    await waitFor(() => expect(detective).toHaveFocus());
  });

  it("keeps one highlight on screen: the chip mark dies with the zone", async () => {
    const user = userEvent.setup();
    const { container } = renderView({
      isRunning: true,
      onCancel: vi.fn(),
      data: makeProgressData({ agents: [makeDetective()] }),
    });
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Progress" })).toHaveAttribute(
        "data-state",
        "focused",
      ),
    );

    await user.keyboard("f");
    await waitFor(() => expect(screen.getByRole("radio", { name: "All" })).toHaveFocus());

    await user.keyboard("{ArrowRight}");
    const detective = screen.getByRole("radio", { name: /Detective/ });
    expect(detective).toHaveFocus();
    expect(detective).toHaveAttribute("aria-checked", "true");
    expect(container.querySelectorAll("[data-highlighted]")).toHaveLength(1);
    expectSingleReticle(container);

    await user.keyboard("{Tab}");
    await waitFor(() => expect(screen.getByRole("log")).toHaveFocus());
    expect(container.querySelectorAll("[data-highlighted]")).toHaveLength(0);
    expectSingleReticle(container);

    await user.keyboard("{Tab}");
    await user.keyboard("{Tab}");
    const cancel = screen.getByRole("button", { name: "Cancel" });
    await waitFor(() => expect(cancel).toHaveFocus());
    const marked = container.querySelectorAll("[data-highlighted]");
    expect(marked).toHaveLength(1);
    expect(marked[0]).toBe(cancel);
    expectSingleReticle(container);
  });

  it("hands ArrowUp at the top of the log back to the selected agent chip", async () => {
    const user = userEvent.setup();
    renderView({
      isRunning: true,
      data: makeProgressData({ agents: [makeDetective()], events: makeLogEvents(5) }),
    });

    const detective = screen.getByRole("radio", { name: /Detective/ });
    await user.click(detective);
    await user.keyboard("{ArrowDown}");
    const log = screen.getByRole("log");
    await waitFor(() => expect(log).toHaveFocus());

    // Scrolled away from the top the log keeps the key: there is history above.
    log.scrollTop = 120;
    await user.keyboard("{ArrowUp}");
    expect(log).toHaveFocus();

    log.scrollTop = 0;
    // A chord is the platform's, not the zone grammar's: the log keeps focus.
    await user.keyboard("{Shift>}{ArrowUp}{/Shift}");
    expect(log).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    await waitFor(() => expect(detective).toHaveFocus());
  });

  it("hands ArrowUp at the top of the log to the header Back when the run has no chip row", async () => {
    const user = userEvent.setup();
    renderView(
      { isRunning: true, data: makeProgressData({ events: makeLogEvents(5) }) },
      { wrapper: HeaderChromeHarness },
    );

    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Progress" })).toHaveAttribute(
        "data-state",
        "focused",
      ),
    );

    const log = screen.getByRole("log");
    await user.keyboard("{Tab}");
    await waitFor(() => expect(log).toHaveFocus());

    await user.keyboard("{ArrowUp}");
    const back = screen.getByRole("button", { name: "Back" });
    await waitFor(() => expect(back).toHaveFocus());
    expect(screen.getByText("\u2193").parentElement).toHaveTextContent("Log");

    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(log).toHaveFocus());
    expect(screen.queryByText("\u2193")).not.toBeInTheDocument();
  });

  it("hands ArrowUp at the top of the progress scroller to the header Back", async () => {
    const user = userEvent.setup();
    renderView({ isRunning: true }, { wrapper: HeaderChromeHarness });

    const progressPane = screen.getByRole("region", { name: "Progress" });
    await waitFor(() => expect(progressPane).toHaveAttribute("data-state", "focused"));
    const scroller = document.activeElement as HTMLElement;

    // Scrolled away from the top the scroller keeps the key: there is content above.
    scroller.scrollTop = 120;
    await user.keyboard("{ArrowUp}");
    expect(scroller).toHaveFocus();

    scroller.scrollTop = 0;
    await user.keyboard("{ArrowUp}");
    const back = screen.getByRole("button", { name: "Back" });
    await waitFor(() => expect(back).toHaveFocus());
    expect(screen.getByText("\u2193").parentElement).toHaveTextContent("Progress");

    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(scroller).toHaveFocus());
    expect(screen.queryByText("\u2193")).not.toBeInTheDocument();
  });

  it("hands ArrowUp from the agent chip row to the header Back", async () => {
    const user = userEvent.setup();
    renderView(
      { isRunning: true, data: makeProgressData({ agents: [makeAgent()] }) },
      { wrapper: HeaderChromeHarness },
    );

    await user.keyboard("f");
    const allChip = screen.getByRole("radio", { name: "All" });
    await waitFor(() => expect(allChip).toHaveFocus());

    await user.keyboard("{ArrowUp}");
    const back = screen.getByRole("button", { name: "Back" });
    await waitFor(() => expect(back).toHaveFocus());
    expect(screen.getByText("\u2193").parentElement).toHaveTextContent("Filters");

    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(allChip).toHaveFocus());
  });

  it("climbs ArrowUp from the action row to the download row to the scroller, never the header Back", async () => {
    const user = userEvent.setup();
    renderView(
      {
        isRunning: false,
        onViewResults: vi.fn(),
        data: makeProgressData({ contextSnapshot: makeContextSnapshot() }),
      },
      { wrapper: HeaderChromeHarness },
    );

    const back = screen.getByRole("button", { name: "Back" });
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Progress" })).toHaveAttribute(
        "data-state",
        "focused",
      ),
    );
    const scroller = document.activeElement as HTMLElement;

    await user.keyboard("{Tab}");
    await user.keyboard("{Tab}");
    const viewResults = screen.getByRole("button", { name: "View Results" });
    await waitFor(() => expect(viewResults).toHaveFocus());

    await user.keyboard("{ArrowUp}");
    const download = screen.getByRole("button", { name: "Download .txt" });
    await waitFor(() => expect(download).toHaveFocus());
    expect(back).not.toHaveFocus();

    await user.keyboard("{ArrowUp}");
    await waitFor(() => expect(scroller).toHaveFocus());
    expect(back).not.toHaveFocus();
  });

  it("walks ArrowDown at the scroller's bottom into the download row, then the action row", async () => {
    const user = userEvent.setup();
    renderView({
      isRunning: false,
      onViewResults: vi.fn(),
      data: makeProgressData({ contextSnapshot: makeContextSnapshot() }),
    });

    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Progress" })).toHaveAttribute(
        "data-state",
        "focused",
      ),
    );
    const scroller = document.activeElement as HTMLElement;

    Object.defineProperties(scroller, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 1_000 },
      scrollTop: { configurable: true, value: 0, writable: true },
    });
    await user.keyboard("{ArrowDown}");
    expect(scroller).toHaveFocus();

    scroller.scrollTop = 900;
    await user.keyboard("{ArrowDown}");
    const download = screen.getByRole("button", { name: "Download .txt" });
    await waitFor(() => expect(download).toHaveFocus());

    await user.keyboard("{ArrowDown}");
    await waitFor(() => expect(screen.getByRole("button", { name: "View Results" })).toHaveFocus());
  });

  it("walks ArrowDown straight into the action row when there is no download row", async () => {
    const user = userEvent.setup();
    renderView({ isRunning: true, onCancel: vi.fn() });

    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Progress" })).toHaveAttribute(
        "data-state",
        "focused",
      ),
    );
    const scroller = document.activeElement as HTMLElement;

    await user.keyboard("{ArrowDown}");
    const cancel = screen.getByRole("button", { name: "Cancel" });
    await waitFor(() => expect(cancel).toHaveFocus());

    await user.keyboard("{ArrowUp}");
    await waitFor(() => expect(scroller).toHaveFocus());
  });

  it("cycles the lens filter with ] and [ without moving focus or zone", async () => {
    const user = userEvent.setup();
    renderView({
      isRunning: true,
      data: makeProgressData({ agents: [makeAgent(), makeDetective()] }),
    });

    const progressPane = screen.getByRole("region", { name: "Progress" });
    await waitFor(() => expect(progressPane).toHaveAttribute("data-state", "focused"));
    const scroller = document.activeElement as HTMLElement;

    const allChip = screen.getByRole("radio", { name: "All" });
    const guardian = screen.getByRole("radio", { name: /Guardian/ });
    const detective = screen.getByRole("radio", { name: /Detective/ });

    await user.keyboard("]");
    await waitFor(() => expect(guardian).toBeChecked());
    expect(scroller).toHaveFocus();

    await user.keyboard("]");
    await waitFor(() => expect(detective).toBeChecked());

    await user.keyboard("]");
    await waitFor(() => expect(allChip).toBeChecked());

    // "[[" is userEvent's escape for a literal [ - a bare [ opens a key descriptor.
    await user.keyboard("[[");
    await waitFor(() => expect(detective).toBeChecked());

    await user.keyboard("[[");
    await waitFor(() => expect(guardian).toBeChecked());
    expect(scroller).toHaveFocus();
    expect(progressPane).toHaveAttribute("data-state", "focused");
  });

  it("cycles the lens filter with ] from the download, action and chip rows too", async () => {
    const user = userEvent.setup();
    renderView({
      isRunning: false,
      onViewResults: vi.fn(),
      data: makeProgressData({
        agents: [makeAgent(), makeDetective()],
        contextSnapshot: makeContextSnapshot(),
      }),
    });

    const guardian = screen.getByRole("radio", { name: /Guardian/ });
    const detective = screen.getByRole("radio", { name: /Detective/ });
    const allChip = screen.getByRole("radio", { name: "All" });
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Progress" })).toHaveAttribute(
        "data-state",
        "focused",
      ),
    );

    await user.keyboard("{Tab}");
    const download = screen.getByRole("button", { name: "Download .txt" });
    await waitFor(() => expect(download).toHaveFocus());
    await user.keyboard("]");
    await waitFor(() => expect(guardian).toBeChecked());
    expect(download).toHaveFocus();

    await user.keyboard("{Tab}");
    const viewResults = screen.getByRole("button", { name: "View Results" });
    await waitFor(() => expect(viewResults).toHaveFocus());
    await user.keyboard("]");
    await waitFor(() => expect(detective).toBeChecked());
    expect(viewResults).toHaveFocus();

    await user.keyboard("{Tab}");
    await waitFor(() => expect(detective).toHaveFocus());
    await user.keyboard("]");
    await waitFor(() => expect(allChip).toBeChecked());
  });

  it("continues past the last action into the log, and stops at the first one", async () => {
    const user = userEvent.setup();
    renderView({ isRunning: true, onCancel: vi.fn(), onViewResults: vi.fn() });

    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Progress" })).toHaveAttribute(
        "data-state",
        "focused",
      ),
    );

    await user.keyboard("{Tab}");
    const cancel = screen.getByRole("button", { name: "Cancel" });
    await waitFor(() => expect(cancel).toHaveFocus());

    // Left of the first action there is no pane to move to.
    await user.keyboard("{ArrowLeft}");
    expect(cancel).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "View Results" })).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(screen.getByRole("log")).toHaveFocus());
  });

  it("names the arrow move per zone in the footer", async () => {
    const user = userEvent.setup();
    renderView({
      isRunning: true,
      onCancel: vi.fn(),
      data: makeProgressData({ agents: [makeDetective()] }),
    });

    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Progress" })).toHaveAttribute(
        "data-state",
        "focused",
      ),
    );
    expect(screen.getByText("←/→").parentElement).toHaveTextContent("Switch Pane");

    // One enabled action: the arrows have no second action to step to.
    await user.keyboard("{Tab}");
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
    expect(screen.getByText("←/→").parentElement).toHaveTextContent("Switch Pane");
    expect(screen.queryByText("Move Action")).not.toBeInTheDocument();

    await user.keyboard("{Tab}");
    await waitFor(() => expect(screen.getByRole("radio", { name: "All" })).toHaveFocus());
    expect(screen.getByText("←/→").parentElement).toHaveTextContent("Move Filter");
    expect(screen.getByText("↓").parentElement).toHaveTextContent("Log");

    await user.keyboard("{Tab}");
    await waitFor(() => expect(screen.getByRole("log")).toHaveFocus());
    expect(screen.getByText("←/→").parentElement).toHaveTextContent("Switch Pane");
    expect(screen.queryByText("Move Filter")).not.toBeInTheDocument();
  });

  it("reaches the snapshot download buttons with Tab and roams them with arrows", async () => {
    const user = userEvent.setup();
    renderView({
      isRunning: false,
      data: makeProgressData({ agents: [makeAgent()], contextSnapshot: makeContextSnapshot() }),
    });

    const progressPane = screen.getByRole("region", { name: "Progress" });
    await waitFor(() => expect(progressPane).toHaveAttribute("data-state", "focused"));

    await user.keyboard("{Tab}");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Download .txt" })).toHaveFocus(),
    );
    // The arrows step the download row, so the footer stops claiming they switch panes.
    expect(screen.getByText("←/→").parentElement).toHaveTextContent("Move Download");

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Download .md" })).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Download .json" })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Download .txt" })).toHaveFocus();

    await user.keyboard("{Tab}");
    await waitFor(() => expect(screen.getByRole("radio", { name: "All" })).toHaveFocus());

    await user.keyboard("{Tab}");
    await waitFor(() => expect(screen.getByRole("log")).toHaveFocus());
  });

  it("moves focus off the downloads with Shift+Tab so arrows switch panes again", async () => {
    const user = userEvent.setup();
    renderView({
      isRunning: false,
      data: makeProgressData({ agents: [makeAgent()], contextSnapshot: makeContextSnapshot() }),
    });

    const progressPane = screen.getByRole("region", { name: "Progress" });
    await waitFor(() => expect(progressPane).toHaveAttribute("data-state", "focused"));

    await user.keyboard("{Tab}");
    const txtButton = screen.getByRole("button", { name: "Download .txt" });
    await waitFor(() => expect(txtButton).toHaveFocus());

    await user.keyboard("{Shift>}{Tab}{/Shift}");
    await waitFor(() => expect(txtButton).not.toHaveFocus());
    expect(progressPane.matches(":focus-within")).toBe(true);
    expect(screen.getByText("←/→").parentElement).toHaveTextContent("Switch Pane");

    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(screen.getByRole("log")).toHaveFocus());
  });

  it("reaches the pane action buttons with Tab and roams them with arrows", async () => {
    const user = userEvent.setup();
    const { container } = renderView({
      isRunning: true,
      onCancel: vi.fn(),
      onViewResults: vi.fn(),
    });

    const progressPane = screen.getByRole("region", { name: "Progress" });
    await waitFor(() => expect(progressPane).toHaveAttribute("data-state", "focused"));

    await user.keyboard("{Tab}");
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const viewResults = screen.getByRole("button", { name: "View Results" });
    await waitFor(() => expect(cancel).toHaveFocus());
    expect(cancel).toHaveAttribute("data-highlighted");
    // The arrows now step the row, so the footer stops claiming they switch panes.
    expect(screen.getByText("←/→").parentElement).toHaveTextContent("Move Action");
    expectSingleReticle(container);

    await user.keyboard("{ArrowRight}");
    expect(viewResults).toHaveFocus();
    expect(viewResults).toHaveAttribute("data-highlighted");
    expect(cancel).not.toHaveAttribute("data-highlighted");

    await user.keyboard("{ArrowLeft}");
    expect(cancel).toHaveFocus();
    expect(cancel).toHaveAttribute("data-highlighted");

    await user.keyboard("{Tab}");
    await waitFor(() => expect(screen.getByRole("log")).toHaveFocus());
  });

  it("moves focus off the pane actions with Shift+Tab so arrows switch panes again", async () => {
    const user = userEvent.setup();
    renderView({ isRunning: true, onCancel: vi.fn(), onViewResults: vi.fn() });

    const progressPane = screen.getByRole("region", { name: "Progress" });
    await waitFor(() => expect(progressPane).toHaveAttribute("data-state", "focused"));

    await user.keyboard("{Tab}");
    const cancel = screen.getByRole("button", { name: "Cancel" });
    await waitFor(() => expect(cancel).toHaveFocus());

    await user.keyboard("{Shift>}{Tab}{/Shift}");
    await waitFor(() => expect(cancel).not.toHaveFocus());
    expect(progressPane.matches(":focus-within")).toBe(true);

    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(screen.getByRole("log")).toHaveFocus());
  });

  it("keeps focus on controls outside the pane when the actions zone is stale", async () => {
    const user = userEvent.setup();
    render(
      <KeyboardProvider>
        <FooterProvider>
          <ReviewProgressView
            data={makeProgressData()}
            isRunning
            onCancel={vi.fn()}
            onViewResults={vi.fn()}
          />
          <button type="button">Settings</button>
          <FooterView />
        </FooterProvider>
      </KeyboardProvider>,
    );

    const progressPane = screen.getByRole("region", { name: "Progress" });
    await waitFor(() => expect(progressPane).toHaveAttribute("data-state", "focused"));

    await user.keyboard("{Tab}");
    const cancel = screen.getByRole("button", { name: "Cancel" });
    await waitFor(() => expect(cancel).toHaveFocus());
    expect(cancel).toHaveAttribute("data-highlighted");

    // App chrome sits outside every zone container, so nothing re-syncs the zone
    // on the way out: it still reads "actions", as the footer's arrow grammar shows.
    const settings = screen.getByRole("button", { name: "Settings" });
    await user.click(settings);
    expect(settings).toHaveFocus();
    expect(screen.getByText("←/→").parentElement).toHaveTextContent("Move Action");

    // The stale zone must not let the action row claim the arrow, or it drags
    // focus off the control the user is standing on and back into [Cancel].
    await user.keyboard("{ArrowRight}");

    expect(settings).toHaveFocus();
  });

  it("parks focus on the progress scroll region when a keyboard-activated Cancel disables mid-mutation", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    // Mirrors the container: activating Cancel flips the pending flag that
    // native-disables the button while the cancel transition runs.
    function PendingCancelHarness() {
      const [pending, setPending] = useState(false);
      return (
        <ReviewProgressView
          data={makeProgressData()}
          isRunning
          onCancel={() => {
            onCancel();
            setPending(true);
          }}
          cancelDisabled={pending}
        />
      );
    }

    const { container } = render(
      <KeyboardProvider>
        <FooterProvider>
          <PendingCancelHarness />
        </FooterProvider>
      </KeyboardProvider>,
    );

    const progressPane = screen.getByRole("region", { name: "Progress" });
    await waitFor(() => expect(progressPane).toHaveAttribute("data-state", "focused"));
    const progressScroll = document.activeElement as HTMLElement;
    expect(progressPane).toContainElement(progressScroll);

    await user.keyboard("{Tab}");
    const cancel = screen.getByRole("button", { name: "Cancel" });
    await waitFor(() => expect(cancel).toHaveFocus());

    await user.keyboard("{Enter}");

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(cancel).toBeDisabled();
    // jsdom keeps focus on a freshly disabled control (real browsers drop it
    // to <body>), so this asserts the proactive park the hook performs, not a
    // browser blur: focus returns to the progress scroll region, keeping the
    // pane reticle lit and the Tab cycle anchored.
    await waitFor(() => expect(progressScroll).toHaveFocus());
    expect(progressPane).toHaveAttribute("data-state", "focused");
    expectSingleReticle(container);
  });

  it("parks focus on the progress scroll region when the focused context Retry unmounts on success", async () => {
    const user = userEvent.setup();
    const onRetryContextRefresh = vi.fn();

    // Mirrors the container: a successful retry clears the refresh error, so the
    // notice and the [Retry] the user is standing on leave the tree.
    function ContextRetryHarness() {
      const [refreshError, setRefreshError] = useState<string | null>(
        "Failed to refresh the review context snapshot.",
      );
      return (
        <ReviewProgressView
          data={makeProgressData()}
          isRunning={false}
          contextRefreshError={refreshError}
          onRetryContextRefresh={() => {
            onRetryContextRefresh();
            setRefreshError(null);
          }}
        />
      );
    }

    const { container } = render(
      <KeyboardProvider>
        <FooterProvider>
          <ContextRetryHarness />
        </FooterProvider>
      </KeyboardProvider>,
    );

    const progressPane = screen.getByRole("region", { name: "Progress" });
    await waitFor(() => expect(progressPane).toHaveAttribute("data-state", "focused"));
    const progressScroll = document.activeElement as HTMLElement;
    expect(progressPane).toContainElement(progressScroll);

    await user.keyboard("{Tab}");
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus());

    await user.keyboard("{Enter}");

    expect(onRetryContextRefresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    // The vanished action must hand focus back instead of dropping it on <body>,
    // where the Tab cycle restarts at the document top and both panes go dark.
    await waitFor(() => expect(progressScroll).toHaveFocus());
    expect(progressPane).toHaveAttribute("data-state", "focused");
    expectSingleReticle(container);
  });

  it("roams the stalled-stream and context recovery buttons with arrows", () => {
    vi.useFakeTimers();
    try {
      renderView({
        isRunning: true,
        reviewId: "review-1",
        onRetry: vi.fn(),
        contextRefreshError: "Failed to refresh the review context snapshot.",
        onRetryContextRefresh: vi.fn(),
        data: makeProgressData({ agents: [makeAgent()], events: makeLogEvents(1) }),
      });

      act(() => vi.advanceTimersByTime(46_000));
      const reconnect = screen.getByRole("button", { name: "Reconnect" });
      const retry = screen.getByRole("button", { name: "Retry" });

      // fireEvent retained: fake timers drive the stall clock; userEvent waits on the same timer queue.
      fireEvent.keyDown(document.body, { key: "Tab" });
      expect(reconnect).toHaveFocus();
      expect(reconnect).toHaveAttribute("data-highlighted");

      // fireEvent retained: fake timers drive the stall clock; userEvent waits on the same timer queue.
      fireEvent.keyDown(reconnect, { key: "ArrowRight" });
      expect(retry).toHaveFocus();
      expect(retry).toHaveAttribute("data-highlighted");
      expect(reconnect).not.toHaveAttribute("data-highlighted");
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders exactly one reticle while the progress pane holds focus", async () => {
    const { container } = renderView();

    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Progress" })).toHaveAttribute(
        "data-state",
        "focused",
      ),
    );

    expectSingleReticle(container);
  });

  it("advertises the bracket lens cycling beside the f chip jump while the run has agents", async () => {
    const user = userEvent.setup();
    renderView({
      isRunning: true,
      onCancel: vi.fn(),
      data: makeProgressData({ agents: [makeAgent()] }),
    });

    // Two gestures on the same row, named apart: the brackets move the lens,
    // f walks focus onto the chips.
    expect(await screen.findByText("[/]")).toBeInTheDocument();
    expect(screen.getByText("[/]").parentElement).toContainElement(screen.getByText("Filter"));
    expect(screen.getByText("f").parentElement).toContainElement(screen.getByText("Filters"));

    await user.keyboard("f");
    await waitFor(() => expect(screen.getByRole("radio", { name: "All" })).toHaveFocus());
    await user.keyboard("{Tab}");
    await waitFor(() => expect(screen.getByRole("log")).toHaveFocus());

    expect(screen.getByText("[/]").parentElement).toContainElement(screen.getByText("Filter"));
    expect(screen.getByText("f").parentElement).toContainElement(screen.getByText("Filters"));
  });

  it("drops the Filter shortcuts when the run has no agents to filter by", async () => {
    renderView({ isRunning: true, onCancel: vi.fn() });

    expect(await screen.findByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.queryByText("Filter")).not.toBeInTheDocument();
    expect(screen.queryByText("Filters")).not.toBeInTheDocument();
    expect(screen.queryByText("[/]")).not.toBeInTheDocument();
    expect(screen.queryByText("f")).not.toBeInTheDocument();
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

    // Two hops: the pane cycle visits the action row between the panes.
    await user.keyboard("{Tab}");
    await waitFor(() => expect(screen.getByRole("button", { name: "View Results" })).toHaveFocus());
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
      data: makeProgressData({ contextSnapshot: makeContextSnapshot() }),
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

      // Past one tick of the shared clock: both readouts then come from the same
      // `now` sample (T0 + 1000 -> 47s), so a readout that sampled Date.now()
      // during render would print T0 + 1600 -> 48s and fail here.
      act(() => vi.advanceTimersByTime(1_600));

      expect(screen.getByText("00:47")).toBeVisible();
      expect(screen.getByText(/waiting for model response · 47s$/)).toBeVisible();
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

// r mirrors the TUI's retry grammar: it fires the recovery affordance the pane
// currently shows, and the footer only advertises it while one is live.
describe("ReviewProgressView r retry grammar", () => {
  it("retries the context refresh with r and advertises the shortcut", async () => {
    const user = userEvent.setup();
    const onRetryContextRefresh = vi.fn();
    renderView({
      isRunning: false,
      contextRefreshError: "Failed to refresh the review context snapshot.",
      onRetryContextRefresh,
    });

    const hint = await screen.findByText("r");
    expect(hint.parentElement).toHaveTextContent("Retry");

    await user.keyboard("r");

    expect(onRetryContextRefresh).toHaveBeenCalledTimes(1);
  });

  it("does not run the r retry when focus is on a button", async () => {
    const user = userEvent.setup();
    const onRetryContextRefresh = vi.fn();
    renderView({
      isRunning: false,
      contextRefreshError: "Failed to refresh the review context snapshot.",
      onRetryContextRefresh,
    });

    (await screen.findByRole("button", { name: "Retry" })).focus();
    await user.keyboard("r");

    expect(onRetryContextRefresh).not.toHaveBeenCalled();
  });

  it("keeps r dead and unadvertised while the stream is healthy", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderView({
      isRunning: true,
      reviewId: "review-1",
      onRetry,
      data: makeProgressData({ agents: [makeAgent()], events: makeLogEvents(1) }),
    });

    await user.keyboard("r");

    expect(onRetry).not.toHaveBeenCalled();
    expect(screen.queryByText("r")).not.toBeInTheDocument();
  });

  it("reconnects the stalled stream with r", () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    try {
      renderView({
        isRunning: true,
        reviewId: "review-1",
        onRetry,
        data: makeProgressData({ agents: [makeAgent()], events: makeLogEvents(1) }),
      });

      act(() => vi.advanceTimersByTime(46_000));
      expect(screen.getByRole("button", { name: "Reconnect" })).toBeVisible();
      const hint = screen.getByText("r");
      expect(hint.parentElement).toHaveTextContent("Retry");

      // fireEvent retained: fake timers drive the stall clock; userEvent waits on the same timer queue.
      fireEvent.keyDown(document.body, { key: "r" });
    } finally {
      vi.useRealTimers();
    }

    expect(onRetry).toHaveBeenCalledWith("review-1");
  });

  it("retries both the stalled stream and the failed context refresh with r", () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    const onRetryContextRefresh = vi.fn();
    try {
      renderView({
        isRunning: true,
        reviewId: "review-1",
        onRetry,
        contextRefreshError: "Failed to refresh the review context snapshot.",
        onRetryContextRefresh,
        data: makeProgressData({ agents: [makeAgent()], events: makeLogEvents(1) }),
      });

      act(() => vi.advanceTimersByTime(46_000));
      expect(screen.getByRole("button", { name: "Reconnect" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
      // The footer's r hint stays truthful: r repairs every visible recovery,
      // not just the stalled stream.
      const hint = screen.getByText("r");
      expect(hint.parentElement).toHaveTextContent("Retry");

      // fireEvent retained: fake timers drive the stall clock; userEvent waits on the same timer queue.
      fireEvent.keyDown(document.body, { key: "r" });
    } finally {
      vi.useRealTimers();
    }

    expect(onRetry).toHaveBeenCalledWith("review-1");
    expect(onRetryContextRefresh).toHaveBeenCalledTimes(1);
  });
});

describe("log focus custody", () => {
  it("keeps the log out of the tab order on every layout, error included", () => {
    const { unmount } = renderView({ data: makeProgressData({ events: makeLogEvents(1) }) });
    expect(screen.getByRole("log", { name: "Activity log" })).toHaveAttribute("tabindex", "-1");
    unmount();

    renderView({ error: "boom", data: makeProgressData({ events: makeLogEvents(1) }) });
    expect(screen.getByRole("log", { name: "Activity log" })).toHaveAttribute("tabindex", "-1");
  });
});
