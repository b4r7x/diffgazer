import { FooterProvider } from "@diffgazer/core/footer";
import {
  createInitialReviewState,
  type ReviewEvent,
  type ReviewState,
  reviewReducer,
} from "@diffgazer/core/review";
import { KeyboardProvider } from "@diffgazer/keys";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  makeAgent,
  makeLogEvent,
  makeLogEvents,
  makeProgressData,
  renderView,
} from "../testing/progress-view";
import { ReviewProgressView } from "./progress-view";

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
