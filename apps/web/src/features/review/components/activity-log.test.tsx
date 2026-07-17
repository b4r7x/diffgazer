import {
  createInitialReviewState,
  type ReviewEvent,
  type ReviewState,
  reviewReducer,
} from "@diffgazer/core/review";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { ActivityLog } from "./activity-log";

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
    expect(log.scrollTop).toBeLessThan(log.scrollHeight - log.clientHeight - 50);
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

    expect(screen.getByText("event-1")).toBeInTheDocument();
    expect(onScroll).toHaveBeenCalledTimes(1);

    log.scrollTop = 900;
    dispatchScroll(log);

    expect(screen.getByText("event-400")).toBeInTheDocument();
    expect(onScroll).toHaveBeenCalledTimes(2);
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
