import {
  convertReviewEventToLogEntry,
  getReviewEventLogSource,
  getReviewEventSequence,
  isReviewEventSequenceContinuation,
  type ReviewEvent,
  type ReviewEventSequence,
} from "@diffgazer/core/review";
import type { LogEntryData } from "@diffgazer/core/schemas/presentation";

export const LOG_WINDOW_SIZE = 200;

interface MatchingPage {
  readonly firstRow: number;
  readonly logicalIndices: readonly number[];
}

export interface EventRowIndex {
  readonly events: readonly ReviewEvent[];
  readonly firstLogicalIndex: number;
  readonly matchingPages: readonly MatchingPage[];
  readonly nextLogicalIndex: number;
  readonly nextMatchingRow: number;
  readonly revision: number;
  readonly sequence: ReviewEventSequence | undefined;
  readonly source: string | null;
}

export interface RowBounds {
  readonly end: number;
  readonly start: number;
}

function buildMatchingPages(
  events: readonly ReviewEvent[],
  source: string,
  firstLogicalIndex: number,
): { pages: readonly MatchingPage[]; nextRow: number } {
  const pages: MatchingPage[] = [];
  let page: number[] = [];
  let pageStart = 0;
  let nextRow = 0;

  for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
    const event = events[eventIndex];
    if (!event || getReviewEventLogSource(event) !== source) continue;
    if (page.length === 0) pageStart = nextRow;
    page.push(firstLogicalIndex + eventIndex);
    nextRow += 1;
    if (page.length === LOG_WINDOW_SIZE) {
      pages.push({ firstRow: pageStart, logicalIndices: page });
      page = [];
    }
  }
  if (page.length > 0) pages.push({ firstRow: pageStart, logicalIndices: page });

  return { pages, nextRow };
}

function createEventRowIndex(
  previous: EventRowIndex | null,
  events: readonly ReviewEvent[],
  source: string | null,
  sequence = getReviewEventSequence(events),
): EventRowIndex {
  const firstLogicalIndex = sequence?.firstIndex ?? 0;
  const matching = source
    ? buildMatchingPages(events, source, firstLogicalIndex)
    : { pages: [], nextRow: 0 };

  return {
    events,
    firstLogicalIndex,
    matchingPages: matching.pages,
    nextLogicalIndex: sequence?.nextIndex ?? events.length,
    nextMatchingRow: matching.nextRow,
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

function pruneMatchingPages(
  pages: readonly MatchingPage[],
  firstLogicalIndex: number,
): readonly MatchingPage[] {
  let pageIndex = 0;
  while (pageIndex < pages.length) {
    const logicalIndices = pages[pageIndex]?.logicalIndices;
    const lastLogicalIndex = logicalIndices?.at(-1);
    if (lastLogicalIndex !== undefined && lastLogicalIndex >= firstLogicalIndex) {
      break;
    }
    pageIndex += 1;
  }
  if (pageIndex === pages.length) return [];

  const firstPage = pages[pageIndex];
  if (!firstPage) return [];
  const firstRetainedOffset = firstPage.logicalIndices.findIndex(
    (logicalIndex) => logicalIndex >= firstLogicalIndex,
  );
  if (firstRetainedOffset <= 0 && pageIndex === 0) return pages;

  const retainedPages = pages.slice(pageIndex);
  if (firstRetainedOffset <= 0) return retainedPages;
  return [
    {
      firstRow: firstPage.firstRow + firstRetainedOffset,
      logicalIndices: firstPage.logicalIndices.slice(firstRetainedOffset),
    },
    ...retainedPages.slice(1),
  ];
}

function appendMatchingIndices(
  pages: readonly MatchingPage[],
  logicalIndices: readonly number[],
  firstRow: number,
): readonly MatchingPage[] {
  if (logicalIndices.length === 0) return pages;

  const nextPages = [...pages];
  let nextIndex = 0;
  const lastPage = nextPages.at(-1);
  if (lastPage && lastPage.logicalIndices.length < LOG_WINDOW_SIZE) {
    const available = LOG_WINDOW_SIZE - lastPage.logicalIndices.length;
    const appended = logicalIndices.slice(0, available);
    nextPages[nextPages.length - 1] = {
      firstRow: lastPage.firstRow,
      logicalIndices: [...lastPage.logicalIndices, ...appended],
    };
    nextIndex = appended.length;
  }

  while (nextIndex < logicalIndices.length) {
    const values = logicalIndices.slice(nextIndex, nextIndex + LOG_WINDOW_SIZE);
    nextPages.push({
      firstRow: firstRow + nextIndex,
      logicalIndices: values,
    });
    nextIndex += values.length;
  }
  return nextPages;
}

function continueEventRowIndex(
  previous: EventRowIndex,
  events: readonly ReviewEvent[],
  sequence: ReviewEventSequence,
): EventRowIndex {
  let matchingPages = pruneMatchingPages(previous.matchingPages, sequence.firstIndex);
  let nextMatchingRow = previous.nextMatchingRow;

  if (previous.source) {
    const appendedLogicalIndices: number[] = [];
    const firstAppendedEvent = previous.nextLogicalIndex - sequence.firstIndex;
    for (let eventIndex = firstAppendedEvent; eventIndex < events.length; eventIndex += 1) {
      const event = events[eventIndex];
      if (event && getReviewEventLogSource(event) === previous.source) {
        appendedLogicalIndices.push(sequence.firstIndex + eventIndex);
      }
    }
    matchingPages = appendMatchingIndices(matchingPages, appendedLogicalIndices, nextMatchingRow);
    nextMatchingRow += appendedLogicalIndices.length;
  }

  return {
    events,
    firstLogicalIndex: sequence.firstIndex,
    matchingPages,
    nextLogicalIndex: sequence.nextIndex,
    nextMatchingRow,
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
  if (!index.source) {
    return { start: index.firstLogicalIndex, end: index.nextLogicalIndex };
  }
  return {
    start: index.matchingPages[0]?.firstRow ?? index.nextMatchingRow,
    end: index.nextMatchingRow,
  };
}

function getMatchingLogicalIndices(
  index: EventRowIndex,
  startRow: number,
  endRow: number,
): number[] {
  const logicalIndices: number[] = [];
  for (const page of index.matchingPages) {
    const pageEnd = page.firstRow + page.logicalIndices.length;
    if (pageEnd <= startRow) continue;
    if (page.firstRow >= endRow) break;
    const start = Math.max(0, startRow - page.firstRow);
    const end = Math.min(page.logicalIndices.length, endRow - page.firstRow);
    logicalIndices.push(...page.logicalIndices.slice(start, end));
  }
  return logicalIndices;
}

function getVisibleLogicalIndices(
  index: EventRowIndex,
  startRow: number,
  endRow: number,
): number[] {
  if (index.source) return getMatchingLogicalIndices(index, startRow, endRow);
  return Array.from({ length: endRow - startRow }, (_, offset) => startRow + offset);
}

export function convertEventRowWindow(
  index: EventRowIndex,
  startRow: number,
  endRow: number,
): LogEntryData[] {
  const entries: LogEntryData[] = [];
  for (const logicalIndex of getVisibleLogicalIndices(index, startRow, endRow)) {
    const event = index.events[logicalIndex - index.firstLogicalIndex];
    if (!event) continue;
    const entry = convertReviewEventToLogEntry(event, logicalIndex);
    if (entry) entries.push(entry);
  }
  return entries;
}

export function getEventRowTail(index: EventRowIndex): ReviewEvent | undefined {
  if (!index.source) return index.events.at(-1);
  const lastPage = index.matchingPages.at(-1);
  const logicalIndex = lastPage?.logicalIndices.at(-1);
  return logicalIndex === undefined
    ? undefined
    : index.events[logicalIndex - index.firstLogicalIndex];
}

export function getAnchoredWindowEnd(bounds: RowBounds, requestedEnd: number): number {
  if (bounds.start >= bounds.end) return bounds.end;
  const firstFullWindowEnd = Math.min(bounds.end, bounds.start + LOG_WINDOW_SIZE);
  return Math.max(firstFullWindowEnd, Math.min(bounds.end, requestedEnd));
}
