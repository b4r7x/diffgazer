// Two event arrays can carry identical indices and still come from different
// dispatch branches (a replay, or a fork off an earlier state), so index equality
// cannot prove that one array continues another. Every appended event mints a
// token derived from the previous array's token, and isReviewEventSequenceContinuation
// walks that chain — only a genuine append lands on `next.token`. `stream` scopes
// tokens to a single review run and `firstIndex` absorbs head trimming, which is
// what lets the activity log reuse its computed rows across an append.

import type { ReviewEvent } from "./state.js";

export interface ReviewEventSequence {
  readonly firstIndex: number;
  readonly nextIndex: number;
  readonly stream: symbol;
  readonly token: object;
}

const eventSequences = new WeakMap<readonly ReviewEvent[], ReviewEventSequence>();
const eventTransitions = new WeakMap<object, WeakMap<ReviewEvent, object>>();

function createSequenceToken(): object {
  return Object.freeze({});
}

function getTransitionToken(parentToken: object, event: ReviewEvent): object {
  let transitions = eventTransitions.get(parentToken);
  if (!transitions) {
    transitions = new WeakMap();
    eventTransitions.set(parentToken, transitions);
  }

  const existing = transitions.get(event);
  if (existing) return existing;
  const token = createSequenceToken();
  transitions.set(event, token);
  return token;
}

export function getReviewEventSequence(
  events: readonly ReviewEvent[],
): ReviewEventSequence | undefined {
  return eventSequences.get(events);
}

export function isReviewEventSequenceContinuation(
  previous: ReviewEventSequence,
  next: ReviewEventSequence,
  nextEvents: readonly ReviewEvent[],
): boolean {
  if (previous.stream !== next.stream) return false;
  if (next.nextIndex - next.firstIndex !== nextEvents.length) return false;
  if (next.firstIndex < previous.firstIndex || next.firstIndex > previous.nextIndex) return false;
  if (next.nextIndex < previous.nextIndex) return false;

  const firstAppendedEvent = previous.nextIndex - next.firstIndex;
  let token = previous.token;
  for (let eventIndex = firstAppendedEvent; eventIndex < nextEvents.length; eventIndex += 1) {
    const event = nextEvents[eventIndex];
    if (!event) return false;
    const nextToken = eventTransitions.get(token)?.get(event);
    if (!nextToken) return false;
    token = nextToken;
  }
  return token === next.token;
}

// Cap on retained streaming events. A long review can emit thousands of agent
// events; without a cap, `[...state.events, event]` becomes O(n) per dispatch
// and the array dominates memory. Once the cap is reached, the oldest events
// are dropped from the head. UI consumers (`convertAgentEventsToLogEntries`,
// log rendering) operate on a windowed view, so dropping ancient events is
// safe for the live log.
const MAX_EVENTS = 5000;

export function appendEvent(events: ReviewEvent[], event: ReviewEvent): ReviewEvent[] {
  const droppedCount = Math.max(0, events.length - MAX_EVENTS + 1);
  const nextEvents = [...events.slice(droppedCount), event];
  const previousSequence = eventSequences.get(events);
  const firstIndex = previousSequence ? previousSequence.firstIndex + droppedCount : 0;

  eventSequences.set(nextEvents, {
    firstIndex,
    nextIndex: previousSequence ? previousSequence.nextIndex + 1 : nextEvents.length,
    stream: previousSequence?.stream ?? Symbol("review-event-stream"),
    token: previousSequence
      ? getTransitionToken(previousSequence.token, event)
      : createSequenceToken(),
  });
  return nextEvents;
}

export function createEventHistory(): ReviewEvent[] {
  const events: ReviewEvent[] = [];
  eventSequences.set(events, {
    firstIndex: 0,
    nextIndex: 0,
    stream: Symbol("review-event-stream"),
    token: createSequenceToken(),
  });
  return events;
}
