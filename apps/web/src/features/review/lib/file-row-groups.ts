import { convertReviewEventToLogEntry, type ReviewEvent } from "@diffgazer/core/review";
import type { LogEntryData } from "@diffgazer/core/schemas/presentation";
import type { EventRowIndex } from "./row-index";

/**
 * One rendered log row standing for one or more underlying window rows.
 * Scroll and paging math must keep counting underlying rows, so each rendered
 * row carries its first underlying row number and how many rows it covers.
 */
export interface FileRowGroup {
  entry: LogEntryData;
  firstRow: number;
  rowCount: number;
}

function fileProgressOf(event: ReviewEvent | undefined) {
  return event?.type === "file_progress" ? event : undefined;
}

/**
 * Web-only presentation grouping: a lens replays its whole prompt-file list as
 * one burst of `file_progress` events, so consecutive FILE rows from the same
 * lens collapse to one rendered row. Deliberate TUI parity break — the TUI
 * keeps its per-file rows. A burst spanning a window boundary renders as two
 * partial groups, one per window; they self-heal as the user pages.
 */
export function groupFileRowWindow(
  index: EventRowIndex,
  startRow: number,
  endRow: number,
): FileRowGroup[] {
  const window = index.matchingRows.slice(startRow - index.firstRow, endRow - index.firstRow);
  const eventAt = (offset: number): ReviewEvent | undefined => {
    const logicalIndex = window[offset];
    return logicalIndex === undefined
      ? undefined
      : index.events[logicalIndex - index.firstLogicalIndex];
  };

  const rows: FileRowGroup[] = [];
  let offset = 0;
  while (offset < window.length) {
    const logicalIndex = window[offset];
    const event = eventAt(offset);
    if (logicalIndex === undefined || !event) {
      offset += 1;
      continue;
    }

    const burst = fileProgressOf(event);
    let last = burst;
    let rowCount = 1;
    if (burst) {
      let next = fileProgressOf(eventAt(offset + rowCount));
      while (next && next.agent === burst.agent) {
        last = next;
        rowCount += 1;
        next = fileProgressOf(eventAt(offset + rowCount));
      }
    }

    // The group keeps the FIRST underlying entry's id, so it stays stable while
    // a burst grows at the tail. A burst that merges across the window start
    // does change id; the anchor restore falls back to the covering row span.
    const entry = convertReviewEventToLogEntry(event, logicalIndex);
    rows.push({
      entry:
        rowCount > 1 && last
          ? {
              ...entry,
              message: `Included ${rowCount} files in prompt (${last.completed}/${last.total})`,
            }
          : entry,
      firstRow: startRow + offset,
      rowCount,
    });
    offset += rowCount;
  }
  return rows;
}
