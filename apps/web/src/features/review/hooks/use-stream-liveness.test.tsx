import {
  createInitialReviewState,
  type ReviewEvent,
  type ReviewState,
  reviewReducer,
} from "@diffgazer/core/review";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useStreamLiveness } from "./use-stream-liveness";

function makeEvent(index: number): ReviewEvent {
  return {
    type: "agent_thinking",
    agent: "detective",
    thought: `event-${index}`,
    timestamp: "2026-01-01T00:00:00.000Z",
  };
}

function appendEvent(state: ReviewState, index: number): ReviewState {
  return reviewReducer(state, { type: "EVENT", event: makeEvent(index) });
}

/** Appends until the capped buffer stops growing, the state a long run reaches. */
function fillEventBuffer(): ReviewState {
  let state = createInitialReviewState();
  let previousLength = -1;
  let index = 0;
  while (state.events.length !== previousLength) {
    previousLength = state.events.length;
    state = appendEvent(state, index);
    index += 1;
  }
  return state;
}

describe("useStreamLiveness", () => {
  it("stays flowing while events keep arriving", () => {
    vi.useFakeTimers();
    try {
      let state = appendEvent(createInitialReviewState(), 0);
      const { result, rerender } = renderHook(
        ({ events }: { events: readonly ReviewEvent[] }) =>
          useStreamLiveness({ events, isRunning: true }),
        { initialProps: { events: state.events } },
      );

      for (let tick = 1; tick <= 12; tick += 1) {
        act(() => vi.advanceTimersByTime(5_000));
        state = appendEvent(state, tick);
        rerender({ events: state.events });
        expect(result.current.state).toBe("flowing");
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("stays flowing once the event buffer is full and events still arrive", () => {
    vi.useFakeTimers();
    try {
      let state = fillEventBuffer();
      const cappedLength = state.events.length;
      const { result, rerender } = renderHook(
        ({ events }: { events: readonly ReviewEvent[] }) =>
          useStreamLiveness({ events, isRunning: true }),
        { initialProps: { events: state.events } },
      );

      for (let tick = 1; tick <= 12; tick += 1) {
        act(() => vi.advanceTimersByTime(5_000));
        state = appendEvent(state, cappedLength + tick);
        rerender({ events: state.events });
      }

      // The buffer never grew, so only array identity could report the arrivals.
      expect(state.events).toHaveLength(cappedLength);
      expect(result.current.state).toBe("flowing");
    } finally {
      vi.useRealTimers();
    }
  });

  it("names the silence at 20s and calls it a stall at 45s", () => {
    vi.useFakeTimers();
    try {
      const events = appendEvent(createInitialReviewState(), 0).events;
      const { result } = renderHook(() => useStreamLiveness({ events, isRunning: true }));

      expect(result.current.state).toBe("flowing");
      act(() => vi.advanceTimersByTime(21_000));
      expect(result.current.state).toBe("quiet");
      act(() => vi.advanceTimersByTime(25_000));
      expect(result.current.state).toBe("stalled");
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders only on the threshold crossings, never once a second", () => {
    vi.useFakeTimers();
    try {
      const events = appendEvent(createInitialReviewState(), 0).events;
      let renderCount = 0;
      renderHook(() => {
        renderCount += 1;
        return useStreamLiveness({ events, isRunning: true });
      });

      act(() => vi.advanceTimersByTime(21_000));
      act(() => vi.advanceTimersByTime(39_000));

      // render-count IS the contract: one mount plus the quiet and stalled
      // transitions. A 1 Hz clock here would re-render the whole progress tree.
      expect(renderCount).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
