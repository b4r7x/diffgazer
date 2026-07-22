import {
  createInitialReviewState,
  type ReviewEvent,
  type ReviewState,
  reviewReducer,
} from "@diffgazer/core/review";
import { describe, expect, it } from "vitest";
import {
  convertEventRowWindow,
  deriveEventRowIndex,
  getAnchoredWindowEnd,
  getEventRowBounds,
} from "./row-index";

const timestamp = "2026-01-01T00:00:00.000Z";

function thinkingEvent(label: string): ReviewEvent {
  return {
    type: "agent_thinking",
    agent: "detective",
    thought: label,
    timestamp,
  };
}

function appendEvent(state: ReviewState, event: ReviewEvent): ReviewState {
  return reviewReducer(state, { type: "EVENT", event });
}

describe("event row index", () => {
  it("continues skipped tagged appends and ring trim from only new rows without mutating the prior index", () => {
    let propertyReads = 0;
    const track = (event: ReviewEvent): ReviewEvent =>
      new Proxy(event, {
        get(target, property, receiver) {
          propertyReads += 1;
          return Reflect.get(target, property, receiver);
        },
      });
    let state = createInitialReviewState();
    for (let index = 0; index < 5_000; index += 1) {
      state = appendEvent(state, track(thinkingEvent(`event-${index}`)));
    }
    const previous = deriveEventRowIndex(null, state.events, "Detective");
    const previousBounds = getEventRowBounds(previous);
    const previousPages = previous.matchingPages;
    let nextState = state;
    for (let offset = 0; offset < 50; offset += 1) {
      const appended = track(thinkingEvent(`event-${5_000 + offset}`));
      nextState = appendEvent(nextState, appended);
    }
    propertyReads = 0;

    const next = deriveEventRowIndex(previous, nextState.events, "Detective");

    expect(propertyReads).toBeLessThan(400);
    expect(next.revision).toBe(previous.revision);
    expect(next.firstLogicalIndex).toBe(50);
    expect(next.nextLogicalIndex).toBe(5_050);
    expect(getEventRowBounds(next)).toEqual({ start: 50, end: 5_050 });
    expect(convertEventRowWindow(next, 5_049, 5_050)[0]?.message).toBe("event-5049");
    expect(previous.matchingPages).toBe(previousPages);
    expect(getEventRowBounds(previous)).toEqual(previousBounds);
    expect(previous.firstLogicalIndex).toBe(0);
    expect(previous.nextLogicalIndex).toBe(5_000);
  });

  it("rebuilds sibling branches before applying a source filter", () => {
    const base = appendEvent(createInitialReviewState(), thinkingEvent("base"));
    const branchA = appendEvent(base, thinkingEvent("branch-a-detective"));
    const branchB = appendEvent(base, {
      type: "agent_thinking",
      agent: "guardian",
      thought: "branch-b-guardian",
      timestamp,
    });
    const indexA = deriveEventRowIndex(null, branchA.events, "Detective");

    const indexB = deriveEventRowIndex(indexA, branchB.events, "Detective");
    const boundsB = getEventRowBounds(indexB);

    expect(indexB.revision).toBe(indexA.revision + 1);
    expect(
      convertEventRowWindow(indexB, boundsB.start, boundsB.end).map((entry) => entry.message),
    ).toEqual(["base"]);
  });

  it("keeps divergent siblings distinct after they append the same tail event identity", () => {
    const base = appendEvent(createInitialReviewState(), thinkingEvent("base"));
    const branchA = appendEvent(base, thinkingEvent("branch-a-detective"));
    const branchB = appendEvent(base, {
      type: "agent_thinking",
      agent: "guardian",
      thought: "branch-b-guardian",
      timestamp,
    });
    const sharedTail = thinkingEvent("shared-tail");
    const branchATail = appendEvent(branchA, sharedTail);
    const branchBTail = appendEvent(branchB, sharedTail);
    const indexA = deriveEventRowIndex(null, branchATail.events, "Detective");

    const indexB = deriveEventRowIndex(indexA, branchBTail.events, "Detective");
    const boundsB = getEventRowBounds(indexB);

    expect(indexB.revision).toBe(indexA.revision + 1);
    expect(
      convertEventRowWindow(indexB, boundsB.start, boundsB.end).map((entry) => entry.message),
    ).toEqual(["base", "shared-tail"]);
  });

  it("rebuilds an untagged same-sample reorder with duplicate event identities exactly", () => {
    const first = thinkingEvent("first");
    const duplicate = thinkingEvent("duplicate");
    const alpha = thinkingEvent("alpha");
    const middle = thinkingEvent("middle");
    const omega = thinkingEvent("omega");
    const last = thinkingEvent("last");
    const initial = [first, duplicate, alpha, middle, duplicate, omega, last];
    const previous = deriveEventRowIndex(null, initial, null);
    const reordered = [first, duplicate, omega, middle, duplicate, alpha, last];

    const next = deriveEventRowIndex(previous, reordered, null);

    expect(next.revision).toBe(previous.revision + 1);
    expect(convertEventRowWindow(next, 0, reordered.length).map((entry) => entry.message)).toEqual([
      "first",
      "duplicate",
      "omega",
      "middle",
      "duplicate",
      "alpha",
      "last",
    ]);
  });

  it("rebuilds an untagged reset even when its first, middle, and last identities match", () => {
    const first = thinkingEvent("first");
    const middle = thinkingEvent("middle");
    const last = thinkingEvent("last");
    const initial = [
      first,
      thinkingEvent("old-a"),
      thinkingEvent("old-b"),
      middle,
      thinkingEvent("old-c"),
      thinkingEvent("old-d"),
      last,
    ];
    const previous = deriveEventRowIndex(null, initial, null);
    const reset = [
      first,
      thinkingEvent("new-a"),
      thinkingEvent("new-b"),
      middle,
      thinkingEvent("new-c"),
      thinkingEvent("new-d"),
      last,
    ];

    const next = deriveEventRowIndex(previous, reset, null);

    expect(next.revision).toBe(previous.revision + 1);
    expect(convertEventRowWindow(next, 0, reset.length).map((entry) => entry.message)).toEqual([
      "first",
      "new-a",
      "new-b",
      "middle",
      "new-c",
      "new-d",
      "last",
    ]);
  });

  it("fills a retained window forward after a partial head eviction", () => {
    expect(getAnchoredWindowEnd({ start: 50, end: 5_050 }, 200)).toBe(250);
    expect(getAnchoredWindowEnd({ start: 50, end: 180 }, 100)).toBe(180);
    expect(getAnchoredWindowEnd({ start: 50, end: 5_050 }, 800)).toBe(800);
  });

  it("filters by the source rendered on the log entry", () => {
    const detective = {
      id: "detective",
      lens: "correctness",
      name: "Detective",
      badgeLabel: "DET",
      badgeVariant: "info",
      description: "Finds bugs",
    } as const;
    const events: ReviewEvent[] = [
      { type: "agent_queued", agent: detective, position: 1, total: 1, timestamp },
      { type: "agent_start", agent: detective, timestamp },
    ];

    const index = deriveEventRowIndex(null, events, "Detective");
    const bounds = getEventRowBounds(index);

    expect(bounds).toEqual({ start: 0, end: 1 });
    expect(convertEventRowWindow(index, bounds.start, bounds.end)).toEqual([
      expect.objectContaining({ tag: "DET", source: "Detective" }),
    ]);
  });
});
