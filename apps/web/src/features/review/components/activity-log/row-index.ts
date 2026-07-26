import {
  convertReviewEventToLogEntry,
  getReviewEventLogSource,
  getReviewEventSequence,
  isAgentHeartbeatEvent,
  isReviewEventSequenceContinuation,
  type ReviewEvent,
  type ReviewEventSequence,
} from "@diffgazer/core/review";
import type { LogEntryData } from "@diffgazer/core/schemas/presentation";

export const LOG_WINDOW_SIZE = 200;

export interface EventRowIndex {
  readonly events: readonly ReviewEvent[];
  readonly firstLogicalIndex: number;
  readonly firstRow: number;
  readonly matchingRows: readonly number[];
  readonly nextLogicalIndex: number;
  readonly revision: number;
  readonly sequence: ReviewEventSequence | undefined;
  readonly source: string | null;
}

export interface RowBounds {
  readonly end: number;
  readonly start: number;
}

/**
 * A row is an event that happened. Heartbeats restate the agent board every ~2s
 * and never earn one, and with a source filter active only that agent's events
 * do. The unfiltered log runs through the same index rather than plain index
 * arithmetic, so both paths agree on what a row is.
 */
function isRowEvent(event: ReviewEvent, source: string | null): boolean {
  if (isAgentHeartbeatEvent(event)) return false;
  return source === null || getReviewEventLogSource(event) === source;
}

function collectMatchingRows(
  events: readonly ReviewEvent[],
  source: string | null,
  firstLogicalIndex: number,
  fromEventIndex = 0,
): number[] {
  const rows: number[] = [];
  for (let eventIndex = fromEventIndex; eventIndex < events.length; eventIndex += 1) {
    const event = events[eventIndex];
    if (event && isRowEvent(event, source)) rows.push(firstLogicalIndex + eventIndex);
  }
  return rows;
}

function createEventRowIndex(
  previous: EventRowIndex | null,
  events: readonly ReviewEvent[],
  source: string | null,
  sequence = getReviewEventSequence(events),
): EventRowIndex {
  const firstLogicalIndex = sequence?.firstIndex ?? 0;

  return {
    events,
    firstLogicalIndex,
    firstRow: 0,
    matchingRows: collectMatchingRows(events, source, firstLogicalIndex),
    nextLogicalIndex: sequence?.nextIndex ?? events.length,
    revision: (previous?.revision ?? 0) + 1,
    sequence,
    source,
  };
}

function canContinueEventRowIndex(
  previous: EventRowIndex,
  events: readonly ReviewEvent[],
  source: string | null,
  sequence: ReviewEventSequence | undefined,
): sequence is ReviewEventSequence {
  if (!previous.sequence || !sequence || previous.source !== source) return false;
  return isReviewEventSequenceContinuation(previous.sequence, sequence, events);
}

function continueEventRowIndex(
  previous: EventRowIndex,
  events: readonly ReviewEvent[],
  sequence: ReviewEventSequence,
): EventRowIndex {
  const firstRetained = previous.matchingRows.findIndex(
    (logicalIndex) => logicalIndex >= sequence.firstIndex,
  );
  const evicted = firstRetained === -1 ? previous.matchingRows.length : firstRetained;
  const retained = evicted === 0 ? previous.matchingRows : previous.matchingRows.slice(evicted);
  const appended = collectMatchingRows(
    events,
    previous.source,
    sequence.firstIndex,
    previous.nextLogicalIndex - sequence.firstIndex,
  );

  return {
    events,
    firstLogicalIndex: sequence.firstIndex,
    firstRow: previous.firstRow + evicted,
    matchingRows: appended.length === 0 ? retained : [...retained, ...appended],
    nextLogicalIndex: sequence.nextIndex,
    revision: previous.revision,
    sequence,
    source: previous.source,
  };
}

export function deriveEventRowIndex(
  previous: EventRowIndex | null,
  events: readonly ReviewEvent[],
  source: string | null,
): EventRowIndex {
  const sequence = getReviewEventSequence(events);
  if (!previous) return createEventRowIndex(null, events, source, sequence);
  if (previous.events === events && previous.source === source) return previous;
  if (!canContinueEventRowIndex(previous, events, source, sequence)) {
    return createEventRowIndex(previous, events, source, sequence);
  }
  return continueEventRowIndex(previous, events, sequence);
}

export function getEventRowBounds(index: EventRowIndex): RowBounds {
  return {
    start: index.firstRow,
    end: index.firstRow + index.matchingRows.length,
  };
}

export function convertEventRowWindow(
  index: EventRowIndex,
  startRow: number,
  endRow: number,
): LogEntryData[] {
  const window = index.matchingRows.slice(startRow - index.firstRow, endRow - index.firstRow);
  const entries: LogEntryData[] = [];
  for (const logicalIndex of window) {
    const event = index.events[logicalIndex - index.firstLogicalIndex];
    if (!event) continue;
    const entry = convertReviewEventToLogEntry(event, logicalIndex);
    if (entry) entries.push(entry);
  }
  return entries;
}

export function getEventRowTail(index: EventRowIndex): ReviewEvent | undefined {
  const logicalIndex = index.matchingRows.at(-1);
  return logicalIndex === undefined
    ? undefined
    : index.events[logicalIndex - index.firstLogicalIndex];
}

export function getAnchoredWindowEnd(bounds: RowBounds, requestedEnd: number): number {
  if (bounds.start >= bounds.end) return bounds.end;
  const firstFullWindowEnd = Math.min(bounds.end, bounds.start + LOG_WINDOW_SIZE);
  return Math.max(firstFullWindowEnd, Math.min(bounds.end, requestedEnd));
}
