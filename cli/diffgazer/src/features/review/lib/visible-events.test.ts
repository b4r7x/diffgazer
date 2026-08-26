import {
  createInitialReviewState,
  type ReviewEvent,
  type ReviewState,
  reviewReducer,
} from "@diffgazer/core/review";
import { describe, expect, test } from "vitest";
import { deriveVisibleEvents } from "./visible-events";

// Counting `type` reads counts classifications: every visibility decision reads
// the event type, and nothing else in the derivation touches the event objects.
let typeReads = 0;

function trackEvent(event: ReviewEvent): ReviewEvent {
  return new Proxy(event, {
    get(target, property, receiver) {
      if (property === "type") typeReads += 1;
      return Reflect.get(target, property, receiver);
    },
  });
}

function appendThinking(state: ReviewState, agent: "detective" | "guardian", label: string) {
  return reviewReducer(state, {
    type: "EVENT",
    event: trackEvent({
      type: "agent_thinking",
      agent,
      timestamp: "2026-01-01T00:00:00.000Z",
      thought: label,
    }),
  });
}

function appendHeartbeat(state: ReviewState) {
  return reviewReducer(state, {
    type: "EVENT",
    event: trackEvent({
      type: "agent_progress",
      agent: "detective",
      progress: 50,
      message: "Waiting for model response",
      timestamp: "2026-01-01T00:00:00.000Z",
    }),
  });
}

function buildThinkingHistory(count: number): ReviewState {
  let state = createInitialReviewState();
  for (let index = 0; index < count; index += 1) {
    state = appendThinking(state, "detective", `event-${index}`);
  }
  return state;
}

function getThoughts(events: readonly ReviewEvent[]): string[] {
  return events.map((event) => (event.type === "agent_thinking" ? event.thought : event.type));
}

describe("deriveVisibleEvents", () => {
  test("drops heartbeats and keeps only the filtered agent's events", () => {
    let state = appendThinking(createInitialReviewState(), "detective", "detective-thought");
    state = appendHeartbeat(state);
    state = appendThinking(state, "guardian", "guardian-thought");

    expect(getThoughts(deriveVisibleEvents(null, state.events, undefined).visible)).toEqual([
      "detective-thought",
      "guardian-thought",
    ]);
    expect(getThoughts(deriveVisibleEvents(null, state.events, "Detective").visible)).toEqual([
      "detective-thought",
    ]);
  });

  test("keeps file_progress events under their agent's source filter", () => {
    let state = appendThinking(createInitialReviewState(), "detective", "detective-thought");
    state = reviewReducer(state, {
      type: "EVENT",
      event: trackEvent({
        type: "file_progress",
        agent: "detective",
        file: "src/a.ts",
        completed: 1,
        total: 2,
        timestamp: "2026-01-01T00:00:00.000Z",
      }),
    });
    state = reviewReducer(state, {
      type: "EVENT",
      event: trackEvent({
        type: "file_progress",
        agent: "guardian",
        file: "src/b.ts",
        completed: 1,
        total: 2,
        timestamp: "2026-01-01T00:00:00.000Z",
      }),
    });

    expect(getThoughts(deriveVisibleEvents(null, state.events, "Detective").visible)).toEqual([
      "detective-thought",
      "file_progress",
    ]);
  });

  test("classifies only the appended events when the history grows", () => {
    const state = buildThinkingHistory(50);
    const first = deriveVisibleEvents(null, state.events, undefined);
    expect(first.visible).toHaveLength(50);

    const next = appendThinking(state, "detective", "event-50");
    typeReads = 0;
    const second = deriveVisibleEvents(first, next.events, undefined);
    const classified = typeReads;

    expect(second.visible).toHaveLength(51);
    expect(getThoughts(second.visible).at(-1)).toBe("event-50");
    expect(second.visible.slice(0, 50)).toEqual(first.visible);
    expect(classified).toBeLessThan(10);
  });

  test("reuses the previous result when neither the history nor the filter changed", () => {
    const state = buildThinkingHistory(3);
    const first = deriveVisibleEvents(null, state.events, "Detective");

    expect(deriveVisibleEvents(first, state.events, "Detective")).toBe(first);
  });

  test("recomputes from scratch when the source filter changes", () => {
    let state = appendThinking(createInitialReviewState(), "detective", "detective-thought");
    state = appendThinking(state, "guardian", "guardian-thought");
    const unfiltered = deriveVisibleEvents(null, state.events, undefined);

    const filtered = deriveVisibleEvents(unfiltered, state.events, "Guardian");

    expect(getThoughts(filtered.visible)).toEqual(["guardian-thought"]);
  });

  test("recomputes from scratch when a new review replaces the history", () => {
    const oldState = buildThinkingHistory(3);
    const previous = deriveVisibleEvents(null, oldState.events, undefined);
    const restarted = appendThinking(
      reviewReducer(oldState, { type: "RESET" }),
      "detective",
      "fresh-thought",
    );

    const next = deriveVisibleEvents(previous, restarted.events, undefined);

    expect(getThoughts(next.visible)).toEqual(["fresh-thought"]);
  });

  test("drops head-trimmed events once the retention cap starts evicting", () => {
    const capped = buildThinkingHistory(5_000);
    const first = deriveVisibleEvents(null, capped.events, undefined);
    expect(getThoughts(first.visible).at(0)).toBe("event-0");

    const trimmed = appendThinking(capped, "detective", "event-5000");
    const second = deriveVisibleEvents(first, trimmed.events, undefined);

    expect(second.visible).toHaveLength(5_000);
    expect(getThoughts(second.visible).at(0)).toBe("event-1");
    expect(getThoughts(second.visible).at(-1)).toBe("event-5000");
    expect(getThoughts(second.visible)).toEqual(getThoughts(trimmed.events));
  });
});
