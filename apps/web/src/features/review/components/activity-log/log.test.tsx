import {
  createInitialReviewState,
  type ReviewEvent,
  type ReviewState,
  reviewReducer,
} from "@diffgazer/core/review";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { ActivityLog } from "./log";

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

function setScrollMetrics(log: HTMLElement, scrollTop: number) {
  Object.defineProperties(log, {
    clientHeight: { configurable: true, value: 100 },
    scrollHeight: { configurable: true, value: 1_000 },
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
      const { rerender } = render(<ActivityLog events={state.events} showCursor />);
      const log = screen.getByRole("log");
      const status = screen.getByRole("status");

      expect(log).toHaveAttribute("aria-live", "off");
      expect(status).toHaveTextContent("");

      state = appendEvent(state, makeEvent(1));
      rerender(<ActivityLog events={state.events} showCursor />);
      act(() => vi.advanceTimersByTime(749));
      expect(status).toHaveTextContent("");
      act(() => vi.advanceTimersByTime(1));
      expect(status).toHaveTextContent("event-1");

      state = appendEvent(state, makeEvent(2));
      rerender(<ActivityLog events={state.events} showCursor />);
      state = appendEvent(state, makeEvent(3));
      rerender(<ActivityLog events={state.events} showCursor />);
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
        <ActivityLog events={state.events} showCursor sourceFilter="Detective" />,
      );
      const status = screen.getByRole("status");

      state = appendEvent(state, {
        type: "agent_thinking",
        agent: "guardian",
        thought: "guardian-event",
        timestamp,
      });
      rerender(<ActivityLog events={state.events} showCursor sourceFilter="Detective" />);
      act(() => vi.advanceTimersByTime(750));
      expect(status).toHaveTextContent("");

      state = appendEvent(state, {
        type: "agent_thinking",
        agent: "detective",
        thought: "detective-event",
        timestamp,
      });
      rerender(<ActivityLog events={state.events} showCursor sourceFilter="Detective" />);
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
