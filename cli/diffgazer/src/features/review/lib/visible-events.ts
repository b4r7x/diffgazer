import {
  getReviewEventLogSource,
  getReviewEventSequence,
  isAgentHeartbeatEvent,
  isReviewEventSequenceContinuation,
  type ReviewEvent,
  type ReviewEventSequence,
} from "@diffgazer/core/review";

// The log shows events that happened. Heartbeats restate the agent board every
// ~2s and never earn a row, and with a source filter active only that agent's
// events do.
function isVisibleEvent(event: ReviewEvent, source: string | undefined): boolean {
  if (isAgentHeartbeatEvent(event)) return false;
  return source === undefined || getReviewEventLogSource(event) === source;
}

function collectVisibleEvents(
  events: readonly ReviewEvent[],
  source: string | undefined,
  fromIndex: number,
): ReviewEvent[] {
  const visible: ReviewEvent[] = [];
  for (let index = fromIndex; index < events.length; index += 1) {
    const event = events[index];
    if (event && isVisibleEvent(event, source)) visible.push(event);
  }
  return visible;
}

function countVisibleEvents(
  events: readonly ReviewEvent[],
  source: string | undefined,
  endIndex: number,
): number {
  let count = 0;
  for (let index = 0; index < endIndex; index += 1) {
    const event = events[index];
    if (event && isVisibleEvent(event, source)) count += 1;
  }
  return count;
}

export interface VisibleEvents {
  readonly events: readonly ReviewEvent[];
  readonly sequence: ReviewEventSequence | undefined;
  readonly source: string | undefined;
  readonly visible: readonly ReviewEvent[];
}

function continueVisibleEvents(
  previous: VisibleEvents,
  previousSequence: ReviewEventSequence,
  events: readonly ReviewEvent[],
  sequence: ReviewEventSequence,
): VisibleEvents | null {
  if (!isReviewEventSequenceContinuation(previousSequence, sequence, events)) return null;

  const trimmedCount = sequence.firstIndex - previousSequence.firstIndex;
  const evicted = countVisibleEvents(previous.events, previous.source, trimmedCount);
  const retained = evicted === 0 ? previous.visible : previous.visible.slice(evicted);
  const appended = collectVisibleEvents(
    events,
    previous.source,
    previousSequence.nextIndex - sequence.firstIndex,
  );

  return {
    events,
    sequence,
    source: previous.source,
    visible: appended.length === 0 ? retained : [...retained, ...appended],
  };
}

// The web log runs the same continuation/eviction/append windowing contract over
// the same core primitives in apps/web/src/features/review/lib/row-index.ts,
// projected to logical row indices instead of retained events. Change both together.
/**
 * Filtered view of the retained event history, extended in place across an
 * append. A streaming review re-renders the log once per event, so recomputing
 * the filter from scratch rescans the whole retained history (up to 5,000
 * entries) every time. The event sequence proves the new array continues the
 * previous one, which leaves only the appended tail to classify and only
 * head-trimmed entries to drop; any other transition — a new stream, a replay,
 * a changed filter — falls back to a full pass.
 */
export function deriveVisibleEvents(
  previous: VisibleEvents | null,
  events: readonly ReviewEvent[],
  sourceFilter: string | undefined,
): VisibleEvents {
  const source = sourceFilter || undefined;
  const sequence = getReviewEventSequence(events);
  if (previous && previous.events === events && previous.source === source) return previous;

  const continued =
    previous?.sequence && sequence && previous.source === source
      ? continueVisibleEvents(previous, previous.sequence, events, sequence)
      : null;

  return (
    continued ?? { events, sequence, source, visible: collectVisibleEvents(events, source, 0) }
  );
}
