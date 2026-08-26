import {
  createInitialReviewState,
  type ReviewEvent,
  type ReviewState,
  reviewReducer,
} from "@diffgazer/core/review";
import { AGENT_METADATA, type AgentState } from "@diffgazer/core/schemas/events";
import { act, render as baseRender, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { KeyboardEvent, ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ReviewClockProvider } from "../../hooks/use-clock";
import { ActivityLog } from "./log";

function RunningClock({ children }: { children: ReactNode }) {
  return <ReviewClockProvider running>{children}</ReviewClockProvider>;
}

/** The pinned tail row prints seconds off the screen clock, so it needs one. */
function render(ui: ReactElement) {
  return baseRender(ui, { wrapper: RunningClock });
}

const timestamp = "2026-01-01T00:00:00.000Z";

function makeEvent(index: number): ReviewEvent {
  return {
    type: "agent_thinking",
    agent: "detective",
    thought: `event-${index}`,
    timestamp,
  };
}

function createTaggedState(events: readonly ReviewEvent[]): ReviewState {
  return events.reduce(
    (state, event) => reviewReducer(state, { type: "EVENT", event }),
    createInitialReviewState(),
  );
}

function appendEvent(state: ReviewState, event: ReviewEvent): ReviewState {
  return reviewReducer(state, { type: "EVENT", event });
}

type ThinkingAgent = Extract<ReviewEvent, { type: "agent_thinking" }>["agent"];

function makeLogEvents(count: number, agent: ThinkingAgent = "detective"): ReviewEvent[] {
  return Array.from({ length: count }, (_, index) => ({
    type: "agent_thinking",
    agent,
    thought: `event-${index}`,
    timestamp,
  }));
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

function setScrollMetrics(log: HTMLElement, scrollTop: number, scrollHeight = 1_000) {
  Object.defineProperties(log, {
    clientHeight: { configurable: true, value: 100 },
    scrollHeight: { configurable: true, value: scrollHeight },
    scrollTop: { configurable: true, value: scrollTop, writable: true },
  });
}

function dispatchScroll(log: HTMLElement) {
  // fireEvent retained: jsdom does not calculate layout or emit scroll after scrollTop changes.
  fireEvent.scroll(log);
}

describe("ActivityLog native callbacks", () => {
  it("tracks scroll-away before a tagged append while calling the consumer", () => {
    let state = createTaggedState([makeEvent(0), makeEvent(1)]);
    const onScroll = vi.fn();
    const { rerender } = render(<ActivityLog events={state.events} onScroll={onScroll} />);
    const log = screen.getByRole("log");
    setScrollMetrics(log, 200);

    dispatchScroll(log);

    expect(onScroll).toHaveBeenCalledTimes(1);
    state = appendEvent(state, makeEvent(2));
    rerender(<ActivityLog events={state.events} onScroll={onScroll} />);

    expect(log.scrollTop).toBe(200);
    expect(screen.getByText("event-2")).toBeInTheDocument();
    expect(onScroll).toHaveBeenCalledTimes(1);
  });

  it("calls onScroll once through previous and next window transitions", () => {
    const state = createTaggedState(Array.from({ length: 401 }, (_, index) => makeEvent(index)));
    const onScroll = vi.fn();
    render(<ActivityLog events={state.events} onScroll={onScroll} />);
    const log = screen.getByRole("log");
    setScrollMetrics(log, 0);

    dispatchScroll(log);

    expect(screen.getByText("event-2")).toBeInTheDocument();
    expect(onScroll).toHaveBeenCalledTimes(1);

    log.scrollTop = 900;
    dispatchScroll(log);

    expect(screen.getByText("event-400")).toBeInTheDocument();
    expect(onScroll).toHaveBeenCalledTimes(2);
  });

  it("restores the first visible row offset after a scroll-triggered previous window", () => {
    const offsetTop = vi
      .spyOn(HTMLElement.prototype, "offsetTop", "get")
      .mockImplementation(function getOffsetTop(this: HTMLElement) {
        if (!this.dataset.logEntryId || !this.parentElement) return 0;
        return Array.from(this.parentElement.children).indexOf(this) * 20 + 8;
      });
    const offsetHeight = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(20);

    try {
      const state = createTaggedState(Array.from({ length: 401 }, (_, index) => makeEvent(index)));
      render(<ActivityLog events={state.events} />);
      const log = screen.getByRole("log");
      setScrollMetrics(log, 0);

      dispatchScroll(log);

      expect(screen.getByText("event-201")).toBeInTheDocument();
      expect(log.scrollTop).toBe(3_980);
    } finally {
      offsetTop.mockRestore();
      offsetHeight.mockRestore();
    }
  });

  it("keeps paged history quiet and throttles new streamed activity announcements", () => {
    vi.useFakeTimers();
    try {
      let state = createTaggedState([makeEvent(0)]);
      const { rerender } = render(<ActivityLog events={state.events} streamState="flowing" />);
      const log = screen.getByRole("log");
      const status = screen.getByRole("status");

      expect(log).toHaveAttribute("aria-live", "off");
      expect(status).not.toHaveTextContent("event-0");

      state = appendEvent(state, makeEvent(1));
      rerender(<ActivityLog events={state.events} streamState="flowing" />);
      act(() => vi.advanceTimersByTime(749));
      expect(status).not.toHaveTextContent("event-1");
      act(() => vi.advanceTimersByTime(1));
      expect(status).toHaveTextContent("event-1");

      state = appendEvent(state, makeEvent(2));
      rerender(<ActivityLog events={state.events} streamState="flowing" />);
      state = appendEvent(state, makeEvent(3));
      rerender(<ActivityLog events={state.events} streamState="flowing" />);
      act(() => vi.advanceTimersByTime(750));
      expect(status).toHaveTextContent("event-3");
      expect(status).not.toHaveTextContent("event-2");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a source-filtered log quiet for non-matching appends and announces the next match", () => {
    vi.useFakeTimers();
    try {
      let state = createTaggedState([makeEvent(0)]);
      const { rerender } = render(
        <ActivityLog events={state.events} streamState="flowing" sourceFilter="Detective" />,
      );
      const status = screen.getByRole("status");

      state = appendEvent(state, {
        type: "agent_thinking",
        agent: "guardian",
        thought: "guardian-event",
        timestamp,
      });
      rerender(
        <ActivityLog events={state.events} streamState="flowing" sourceFilter="Detective" />,
      );
      act(() => vi.advanceTimersByTime(750));
      expect(status).not.toHaveTextContent("guardian-event");

      state = appendEvent(state, {
        type: "agent_thinking",
        agent: "detective",
        thought: "detective-event",
        timestamp,
      });
      rerender(
        <ActivityLog events={state.events} streamState="flowing" sourceFilter="Detective" />,
      );
      act(() => vi.advanceTimersByTime(750));
      expect(status).toHaveTextContent("detective-event");
    } finally {
      vi.useRealTimers();
    }
  });

  it("calls onKeyDown once while Home, PageDown, PageUp, and End navigate", async () => {
    const user = userEvent.setup();
    const state = createTaggedState(Array.from({ length: 401 }, (_, index) => makeEvent(index)));
    const onKeyDown = vi.fn((event: KeyboardEvent<HTMLDivElement>) => {
      event.preventDefault();
    });
    render(<ActivityLog events={state.events} onKeyDown={onKeyDown} />);
    const log = screen.getByRole("log");
    setScrollMetrics(log, 1_000);
    log.focus();

    await user.keyboard("{Home}");
    expect(await screen.findByText("event-0")).toBeInTheDocument();
    expect(onKeyDown).toHaveBeenCalledTimes(1);

    await user.keyboard("{PageDown}");
    expect(await screen.findByText("event-200")).toBeInTheDocument();
    expect(onKeyDown).toHaveBeenCalledTimes(2);

    await user.keyboard("{PageUp}");
    expect(await screen.findByText("event-0")).toBeInTheDocument();
    expect(onKeyDown).toHaveBeenCalledTimes(3);

    await user.keyboard("{End}");
    expect(await screen.findByText("event-400")).toBeInTheDocument();
    expect(onKeyDown).toHaveBeenCalledTimes(4);
  });
});

describe("ActivityLog boundary reporting", () => {
  it("reports the top boundary on ArrowUp only once nothing is left above", async () => {
    const user = userEvent.setup();
    const state = createTaggedState(makeLogEvents(401));
    const onTopBoundaryReached = vi.fn();
    render(<ActivityLog events={state.events} onTopBoundaryReached={onTopBoundaryReached} />);
    const log = screen.getByRole("log");
    log.focus();

    setScrollMetrics(log, 200);
    await user.keyboard("{ArrowUp}");
    expect(onTopBoundaryReached).not.toHaveBeenCalled();

    // At the top of the rendered window, but an earlier window is still paged
    // out: the log owns the key so the history stays reachable.
    setScrollMetrics(log, 0);
    await user.keyboard("{ArrowUp}");
    expect(onTopBoundaryReached).not.toHaveBeenCalled();

    await user.keyboard("{Home}");
    expect(await screen.findByText("event-0")).toBeInTheDocument();

    await user.keyboard("{ArrowUp}");
    expect(onTopBoundaryReached).toHaveBeenCalledTimes(1);
    // The key was claimed, so the container's own scroll never ran.
    expect(log.scrollTop).toBe(0);
  });

  it("leaves a modified ArrowUp at the top edge to the scroller", async () => {
    const user = userEvent.setup();
    const state = createTaggedState(makeLogEvents(5));
    const onTopBoundaryReached = vi.fn();
    render(<ActivityLog events={state.events} onTopBoundaryReached={onTopBoundaryReached} />);
    const log = screen.getByRole("log");
    log.focus();
    setScrollMetrics(log, 0);

    await user.keyboard("{Shift>}{ArrowUp}{/Shift}");

    // Handing focus to another zone is the one move in here that must not fire
    // on a chord the user meant for the platform.
    expect(onTopBoundaryReached).not.toHaveBeenCalled();

    await user.keyboard("{ArrowUp}");
    expect(onTopBoundaryReached).toHaveBeenCalledTimes(1);
  });

  it("leaves ArrowUp native when nothing is listening for the boundary", () => {
    const state = createTaggedState(makeLogEvents(5));
    render(<ActivityLog events={state.events} />);
    const log = screen.getByRole("log");
    log.focus();

    // The narrow layout, where the log has no scrolling box of its own: a
    // claimed ArrowUp would move nothing at all here.
    setScrollMetrics(log, 0, 100);

    // fireEvent retained: the contract is the keydown's defaultPrevented verdict -- whether the
    // key still reaches the scroller underneath -- which userEvent does not expose.
    expect(fireEvent.keyDown(log, { key: "ArrowUp" })).toBe(true);
  });
});

describe("ActivityLog paging", () => {
  it("shows the oldest retained page when the paged-back window is fully evicted", async () => {
    const user = userEvent.setup();
    const events = makeLogEvents(5_000);
    let state = createTaggedState(events);
    const { rerender } = render(<ActivityLog events={state.events} />);
    const log = screen.getByRole("log");

    log.focus();
    await user.keyboard("{Home}");
    expect(screen.getByText("event-0")).toBeInTheDocument();

    for (let offset = 0; offset < 200; offset += 1) {
      state = appendEvent(state, {
        type: "agent_thinking",
        agent: "detective",
        thought: `event-${5_000 + offset}`,
        timestamp,
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
    let state = createTaggedState(makeLogEvents(5_000));
    const { rerender } = render(<ActivityLog events={state.events} />);
    const log = screen.getByRole("log");

    log.focus();
    await user.keyboard("{Home}");
    expect(screen.getByText("event-0")).toBeInTheDocument();

    for (let offset = 0; offset < 50; offset += 1) {
      state = appendEvent(state, {
        type: "agent_thinking",
        agent: "detective",
        thought: `event-${5_000 + offset}`,
        timestamp,
      });
    }
    rerender(<ActivityLog events={state.events} />);

    expect(screen.getByText("event-50")).toBeInTheDocument();
    expect(screen.getByText("event-249")).toBeInTheDocument();
    expect(screen.queryByText("event-250")).not.toBeInTheDocument();
    expect(screen.getAllByText(/^event-/)).toHaveLength(200);
  });
});

describe("ActivityLog indexing", () => {
  it("renders untagged reorder and reset replacements exactly with duplicate identities", () => {
    const event = (thought: string): ReviewEvent => ({
      type: "agent_thinking",
      agent: "detective",
      thought,
      timestamp,
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

  it("indexes a sparse agent filter once and pages it without rescanning history", async () => {
    const user = userEvent.setup();
    const rawEvents = makeLogEvents(5_000, "guardian");
    for (let index = 9; index < rawEvents.length; index += 10) {
      rawEvents[index] = {
        type: "agent_thinking",
        agent: "detective",
        thought: `detective-${index}`,
        timestamp,
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
});

describe("ActivityLog streaming", () => {
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
            timestamp,
          },
        ]}
      />,
    );

    await waitFor(() => expect(log.scrollTop).toBe(300));
    expect(screen.getByText("event-2")).toBeInTheDocument();
  });
});

describe("ActivityLog pinned scroll contract", () => {
  it("keeps a catch-up rewindow unpinned instead of teleporting past unread entries", () => {
    let state = createTaggedState(makeLogEvents(401));
    const { rerender } = render(<ActivityLog events={state.events} />);
    const log = screen.getByRole("log");
    setScrollMetrics(log, 0);
    dispatchScroll(log);
    expect(screen.getByText("event-2")).toBeInTheDocument();

    for (let offset = 0; offset < 3; offset += 1) {
      state = appendEvent(state, makeEvent(401 + offset));
    }
    rerender(<ActivityLog events={state.events} />);
    expect(screen.getByRole("button", { name: "Jump to 3 new entries" })).toBeInTheDocument();

    log.scrollTop = 900;
    dispatchScroll(log);
    log.scrollTop = 900;
    // This catch-up reaches the live end of the row range.
    dispatchScroll(log);

    // The anchor restore keeps the reader's offset; no tail snap to scrollHeight.
    expect(log.scrollTop).toBe(900);
    expect(screen.queryByRole("button", { name: /jump to/i })).not.toBeInTheDocument();

    state = appendEvent(state, makeEvent(404));
    state = appendEvent(state, makeEvent(405));
    rerender(<ActivityLog events={state.events} />);

    expect(log.scrollTop).toBe(900);
    expect(screen.getByRole("button", { name: "Jump to 2 new entries" })).toBeInTheDocument();
  });

  it("keeps the unseen count while paging back into history", async () => {
    const user = userEvent.setup();
    let state = createTaggedState(makeLogEvents(401));
    const { rerender } = render(<ActivityLog events={state.events} />);
    const log = screen.getByRole("log");
    setScrollMetrics(log, 200);
    dispatchScroll(log);

    for (let offset = 0; offset < 3; offset += 1) {
      state = appendEvent(state, makeEvent(401 + offset));
    }
    rerender(<ActivityLog events={state.events} />);
    expect(screen.getByRole("button", { name: "Jump to 3 new entries" })).toBeInTheDocument();

    log.focus();
    await user.keyboard("{PageUp}");

    expect(screen.getByRole("button", { name: "Jump to 3 new entries" })).toBeInTheDocument();
  });

  it("never writes scrollTop from arrivals while unpinned during an event burst", () => {
    let state = createTaggedState(makeLogEvents(3));
    const { rerender } = render(<ActivityLog events={state.events} />);
    const log = screen.getByRole("log");
    setScrollMetrics(log, 200);
    dispatchScroll(log);

    for (let offset = 0; offset < 20; offset += 1) {
      state = appendEvent(state, makeEvent(3 + offset));
      rerender(<ActivityLog events={state.events} />);
    }

    expect(log.scrollTop).toBe(200);
    expect(screen.getByText("event-22")).toBeInTheDocument();
  });

  it("pins on a scroll gesture reaching the true bottom so the tail follows again", async () => {
    let state = createTaggedState(makeLogEvents(3));
    const { rerender } = render(<ActivityLog events={state.events} />);
    const log = screen.getByRole("log");
    setScrollMetrics(log, 200);
    dispatchScroll(log);
    state = appendEvent(state, makeEvent(3));
    rerender(<ActivityLog events={state.events} />);
    expect(log.scrollTop).toBe(200);

    log.scrollTop = 900;
    dispatchScroll(log);
    state = appendEvent(state, makeEvent(4));
    rerender(<ActivityLog events={state.events} />);

    await waitFor(() => expect(log.scrollTop).toBe(1_000));
  });

  it("shows the new entries affordance while unpinned and jumps to the live end on click", async () => {
    const user = userEvent.setup();
    let state = createTaggedState(makeLogEvents(3));
    const { rerender } = render(<ActivityLog events={state.events} />);
    const log = screen.getByRole("log");
    expect(screen.queryByRole("button", { name: /jump to/i })).not.toBeInTheDocument();

    setScrollMetrics(log, 200);
    dispatchScroll(log);
    state = appendEvent(state, makeEvent(3));
    state = appendEvent(state, makeEvent(4));
    rerender(<ActivityLog events={state.events} />);

    const jump = screen.getByRole("button", { name: "Jump to 2 new entries" });
    expect(jump).toHaveTextContent("↓ 2 new entries · End");

    await user.click(jump);

    expect(screen.queryByRole("button", { name: /jump to/i })).not.toBeInTheDocument();
    expect(log.scrollTop).toBe(1_000);
    expect(screen.getByText("event-4")).toBeInTheDocument();
  });

  it("pins with the End key and clears the new entries affordance", async () => {
    const user = userEvent.setup();
    let state = createTaggedState(makeLogEvents(3));
    const { rerender } = render(<ActivityLog events={state.events} />);
    const log = screen.getByRole("log");
    setScrollMetrics(log, 200);
    dispatchScroll(log);
    state = appendEvent(state, makeEvent(3));
    rerender(<ActivityLog events={state.events} />);
    expect(screen.getByRole("button", { name: /jump to/i })).toBeInTheDocument();

    log.focus();
    await user.keyboard("{End}");

    expect(screen.queryByRole("button", { name: /jump to/i })).not.toBeInTheDocument();
    state = appendEvent(state, makeEvent(4));
    rerender(<ActivityLog events={state.events} />);
    await waitFor(() => expect(log.scrollTop).toBe(1_000));
  });

  it("force-pins on a source filter change so the tail follows the filtered live end", async () => {
    let state = createTaggedState(makeLogEvents(3));
    const { rerender } = render(<ActivityLog events={state.events} />);
    const log = screen.getByRole("log");
    setScrollMetrics(log, 200);
    dispatchScroll(log);
    state = appendEvent(state, makeEvent(3));
    rerender(<ActivityLog events={state.events} />);
    expect(log.scrollTop).toBe(200);

    rerender(<ActivityLog events={state.events} sourceFilter="Detective" />);
    // The switch itself lands at the live end: no parked-at-top state waiting
    // for the next arrival to teleport the reader.
    expect(log.scrollTop).toBe(1_000);

    state = appendEvent(state, makeEvent(4));
    rerender(<ActivityLog events={state.events} sourceFilter="Detective" />);

    await waitFor(() => expect(log.scrollTop).toBe(1_000));
  });

  it("ignores the echo of its own scroll write instead of paging the window", () => {
    let state = createTaggedState(makeLogEvents(401));
    const { rerender } = render(<ActivityLog events={state.events} />);
    const log = screen.getByRole("log");
    setScrollMetrics(log, 900);

    // Pinned on mount: the appended tail writes scrollTop programmatically.
    state = appendEvent(state, makeEvent(401));
    rerender(<ActivityLog events={state.events} />);
    expect(log.scrollTop).toBe(1_000);

    // A clamped restore can land the echo at the top edge; it must not page
    // the window back, or the re-window loop re-ignites.
    log.scrollTop = 0;
    dispatchScroll(log);
    expect(screen.queryByText("event-3")).not.toBeInTheDocument();

    // The next scroll is a user gesture again and pages back normally.
    dispatchScroll(log);
    expect(screen.getByText("event-3")).toBeInTheDocument();
  });

  it("stays pinned when its tail write's echo arrives after the content already grew", () => {
    let state = createTaggedState(makeLogEvents(3));
    const { rerender } = render(<ActivityLog events={state.events} />);
    const log = screen.getByRole("log");
    setScrollMetrics(log, 0);

    // Pinned: the appended tail writes scrollTop programmatically.
    state = appendEvent(state, makeEvent(3));
    rerender(<ActivityLog events={state.events} />);
    expect(log.scrollTop).toBe(1_000);

    // Before the echo is processed, another arrival grows the content, so the
    // echo reads "away from the bottom". It carries no user intent and must
    // not unpin the follower.
    setScrollMetrics(log, 1_000, 2_000);
    dispatchScroll(log);

    state = appendEvent(state, makeEvent(4));
    rerender(<ActivityLog events={state.events} />);
    expect(screen.queryByRole("button", { name: /jump to/i })).not.toBeInTheDocument();
    expect(log.scrollTop).toBe(2_000);
  });

  it("re-pins a replaced event array to the live end", () => {
    const { rerender } = render(<ActivityLog events={makeLogEvents(3)} />);
    const log = screen.getByRole("log");
    setScrollMetrics(log, 200);
    dispatchScroll(log);

    // Untagged arrays carry no sequence, so the replacement bumps the revision:
    // a new stream, in which the old reading position is meaningless.
    let state = createTaggedState(makeLogEvents(5));
    rerender(<ActivityLog events={state.events} />);
    expect(screen.getByText("event-4")).toBeInTheDocument();
    expect(log.scrollTop).toBe(1_000);

    // Re-pinned: a later arrival follows the tail instead of feeding the
    // new-entries affordance.
    state = appendEvent(state, makeEvent(5));
    rerender(<ActivityLog events={state.events} />);
    expect(screen.queryByRole("button", { name: /jump to/i })).not.toBeInTheDocument();
    expect(log.scrollTop).toBe(1_000);
  });
});

describe("ActivityLog FILE row grouping", () => {
  function fileEvent(completed: number, total: number): ReviewEvent {
    return {
      type: "file_progress",
      agent: "detective",
      file: `src/file-${completed}.ts`,
      completed,
      total,
      timestamp,
    };
  }

  it("renders a same-lens FILE burst as one grouped row with surrounding rows intact", () => {
    let state = createTaggedState([makeEvent(0)]);
    for (let completed = 1; completed <= 3; completed += 1) {
      state = appendEvent(state, fileEvent(completed, 3));
    }
    state = appendEvent(state, makeEvent(1));
    render(<ActivityLog events={state.events} />);

    expect(screen.getByText("Included 3 files in prompt (3/3)")).toBeInTheDocument();
    expect(screen.queryByText(/Included src\//)).not.toBeInTheDocument();
    expect(screen.getByText("event-0")).toBeInTheDocument();
    expect(screen.getByText("event-1")).toBeInTheDocument();
  });

  it("counts underlying rows, not grouped rows, in the new entries affordance", () => {
    let state = createTaggedState(makeLogEvents(3));
    const { rerender } = render(<ActivityLog events={state.events} />);
    const log = screen.getByRole("log");
    setScrollMetrics(log, 200);
    dispatchScroll(log);

    for (let completed = 1; completed <= 5; completed += 1) {
      state = appendEvent(state, fileEvent(completed, 5));
    }
    rerender(<ActivityLog events={state.events} />);

    expect(screen.getByText("Included 5 files in prompt (5/5)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jump to 5 new entries" })).toBeInTheDocument();
  });
});

describe("ActivityLog heartbeats and live tail row", () => {
  function heartbeat(progress: number): ReviewEvent {
    return {
      type: "agent_progress",
      agent: "detective",
      progress,
      message: "Waiting for model response",
      timestamp,
    };
  }

  const detectiveMeta = AGENT_METADATA.detective;
  const runningDetective: AgentState[] = [
    {
      id: "detective",
      status: "running",
      progress: 65,
      issueCount: 0,
      meta: detectiveMeta,
    },
  ];

  it("keeps heartbeat pings out of the log body", () => {
    let state = createTaggedState([makeEvent(0)]);
    for (const progress of [10, 20, 30, 40]) state = appendEvent(state, heartbeat(progress));

    render(<ActivityLog events={state.events} streamState="flowing" />);

    expect(screen.getByText("event-0")).toBeVisible();
    expect(screen.queryAllByText(/Waiting for model response/)).toHaveLength(0);
  });

  it("still appends a real event after a burst of heartbeats", () => {
    let state = createTaggedState([makeEvent(0)]);
    state = appendEvent(state, heartbeat(10));
    state = appendEvent(state, makeEvent(1));

    render(<ActivityLog events={state.events} streamState="flowing" />);

    expect(screen.getByText("event-1")).toBeVisible();
  });

  it("pins what is happening now, with the agent and the elapsed time", () => {
    vi.useFakeTimers();
    try {
      const state = createTaggedState([makeEvent(0)]);

      render(
        <ActivityLog
          events={state.events}
          streamState="flowing"
          agents={runningDetective}
          startTime={new Date(Date.now() - 46_000)}
        />,
      );

      expect(screen.getByText("Detective · waiting for model response · 46s")).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });

  // A run that has not queued anyone yet is still starting, so the tail row
  // must not claim a previous agent.
  it("names the wait as the first agent before the roster exists", () => {
    const { container } = render(<ActivityLog events={[]} streamState="flowing" agents={[]} />);

    expect(container.querySelector("[data-log-tail]")).toHaveTextContent(
      /waiting for the first agent/,
    );
  });

  it("names the wait as the next agent once the roster exists", () => {
    const finishedDetective: AgentState[] = [
      { id: "detective", status: "complete", progress: 100, issueCount: 0, meta: detectiveMeta },
    ];

    const { container } = render(
      <ActivityLog events={[]} streamState="flowing" agents={finishedDetective} />,
    );

    expect(container.querySelector("[data-log-tail]")).toHaveTextContent(
      /waiting for the next agent/,
    );
  });

  it("keeps counting the elapsed time while the run stays silent", () => {
    vi.useFakeTimers();
    try {
      const state = createTaggedState([makeEvent(0)]);

      render(
        <ActivityLog
          events={state.events}
          streamState="flowing"
          agents={runningDetective}
          startTime={new Date(Date.now() - 46_000)}
        />,
      );

      act(() => vi.advanceTimersByTime(3_000));

      expect(screen.getByText("Detective · waiting for model response · 49s")).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });

  it("narrows the tail row to the filtered agent", () => {
    vi.useFakeTimers();
    try {
      const state = createTaggedState([makeEvent(0)]);

      render(
        <ActivityLog
          events={state.events}
          streamState="flowing"
          sourceFilter="Detective"
          agents={runningDetective}
          startTime={new Date(Date.now() - 12_000)}
        />,
      );

      expect(screen.getByText("Detective · waiting for model response · 12s")).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });

  it("freezes the cursor and names the stall when the stream dies", () => {
    vi.useFakeTimers();
    try {
      const state = createTaggedState([makeEvent(0)]);

      const { container } = render(
        <ActivityLog
          events={state.events}
          streamState="stalled"
          agents={runningDetective}
          startTime={new Date(Date.now() - 90_000)}
          lastEventAt={Date.now() - 51_000}
        />,
      );

      expect(screen.getByText("stream stalled · last event 51s ago")).toBeVisible();
      expect(container.querySelector("[data-log-tail]")).toHaveAttribute(
        "data-log-tail",
        "stalled",
      );
      // class assertion retained: the frozen cursor is CSS-only, so the absence of
      // the blink class is the only observable form the stopped cursor takes.
      expect(container.querySelector(".cursor-blink")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops announcing the tail sentence once the run is over", () => {
    const state = createTaggedState([makeEvent(0)]);
    const tail = (streamState: "flowing" | undefined) => (
      <ActivityLog
        events={state.events}
        streamState={streamState}
        agents={runningDetective}
        startTime={new Date(Date.now() - 5_000)}
      />
    );

    const { rerender } = render(tail("flowing"));
    expect(screen.getByRole("status")).toHaveTextContent("Detective · waiting for model response");

    rerender(tail(undefined));

    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("empties the live region of the last streamed line once the run is over", () => {
    vi.useFakeTimers();
    try {
      let state = createTaggedState([makeEvent(0)]);
      const { rerender } = render(<ActivityLog events={state.events} streamState="flowing" />);
      const status = screen.getByRole("status");

      state = appendEvent(state, makeEvent(1));
      rerender(<ActivityLog events={state.events} streamState="flowing" />);
      act(() => vi.advanceTimersByTime(750));
      expect(status).toHaveTextContent("event-1");

      // The region is aria-atomic: leaving the mid-run line behind makes the tail
      // row's removal re-announce it after the run has already finished.
      rerender(<ActivityLog events={state.events} />);
      expect(status).toHaveTextContent("");
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves no dangling cursor once the run is over", () => {
    const state = createTaggedState([makeEvent(0)]);

    render(<ActivityLog events={state.events} agents={runningDetective} />);

    expect(screen.queryByText(/waiting for model response/)).not.toBeInTheDocument();
  });
});
