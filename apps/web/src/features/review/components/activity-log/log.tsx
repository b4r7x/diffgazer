import type { LogStreamState, ReviewEvent } from "@diffgazer/core/review";
import type { AgentState } from "@diffgazer/core/schemas/events";
import { hasModifierKey } from "@diffgazer/keys";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { cn } from "@diffgazer/ui/lib/utils";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { groupFileRowWindow } from "../../lib/file-row-groups";
import {
  convertEventRowWindow,
  deriveEventRowIndex,
  type EventRowIndex,
  getAnchoredWindowEnd,
  getEventRowBounds,
  getEventRowTail,
  LOG_WINDOW_SIZE,
} from "../../lib/row-index";
import { ActivityLogAnnouncement } from "./announcement";
import { LogEntry } from "./entry";
import { buildTailStatus, LiveTailRow } from "./live-tail-row";
import { NewEntriesRow } from "./new-entries-row";

export interface ActivityLogProps extends React.HTMLAttributes<HTMLDivElement> {
  events: readonly ReviewEvent[];
  sourceFilter?: string | null;
  /**
   * Liveness of the run behind the log. `null`/undefined means the run is not
   * streaming, and the pinned tail row is not rendered at all.
   */
  streamState?: LogStreamState | null;
  agents?: readonly AgentState[];
  /** Run start, for the tail row's elapsed clock. */
  startTime?: Date;
  /** Epoch ms of the last event; drives the "last event Xs ago" stall clock. */
  lastEventAt?: number;
  /**
   * Fired when ArrowUp asks for more log above the top of the history: the
   * view is at scroll offset 0 and no earlier window is left to page back to.
   * Left out, ArrowUp is left to the scroller instead of being claimed for nobody.
   * The bottom edge is owned by PageDown/End, so there is no second direction.
   */
  onTopBoundaryReached?: () => void;
}

interface LogWindowState {
  cacheRevision: number;
  endRow: number;
  /** Rows seen up to here; arrivals beyond it feed the new-entries affordance. */
  lastSeenEnd: number;
  /**
   * Following the live tail. Set true only by user gestures (scrolling to the
   * true bottom, End, the new-entries affordance, a filter switch) and on
   * mount; window arithmetic never pins, so arrivals cannot steal the scroll
   * position from a reader who is back in the history.
   */
  pinned: boolean;
  sourceFilter: string | undefined;
}

type ScrollAlignment = "end" | "start";

interface ScrollWindowAnchor {
  entryId: string;
  pixelOffset: number;
  row: number;
}

// A programmatic scrollTop write echoes back as a scroll event that carries no
// user intent; the flag lets handleScroll tell the echo from a gesture. Only a
// write that actually moved the container echoes (a clamped or equal write
// fires no event), so the flag arms on the observed change.
function writeScrollTop(
  programmaticScrollRef: { current: boolean },
  container: HTMLElement,
  scrollTop: number,
) {
  const before = container.scrollTop;
  container.scrollTop = scrollTop;
  if (container.scrollTop !== before) {
    programmaticScrollRef.current = true;
  }
}

export function ActivityLog({
  events,
  sourceFilter,
  streamState = null,
  agents = [],
  startTime,
  lastEventAt,
  className,
  onKeyDown,
  onTopBoundaryReached,
  onScroll,
  ...props
}: ActivityLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const programmaticScrollRef = useRef(false);
  const pendingScrollAlignmentRef = useRef<ScrollAlignment | null>(null);
  const pendingWindowAnchorRef = useRef<ScrollWindowAnchor | null>(null);
  const committedRowIndexRef = useRef<EventRowIndex | null>(null);
  const normalizedSourceFilter = sourceFilter || undefined;
  const rowIndex = deriveEventRowIndex(
    committedRowIndexRef.current,
    events,
    normalizedSourceFilter,
  );

  useLayoutEffect(() => {
    committedRowIndexRef.current = rowIndex;
  }, [rowIndex]);

  const cacheRevision = rowIndex.revision;
  const rowBounds = getEventRowBounds(rowIndex);
  const [windowState, setWindowState] = useState<LogWindowState>(() => ({
    cacheRevision,
    endRow: rowBounds.end,
    lastSeenEnd: rowBounds.end,
    pinned: true,
    sourceFilter: normalizedSourceFilter,
  }));

  // Render-time adjustment for a stale window (the React "information from
  // previous renders" pattern): a filter switch is a view change and lands the
  // reader on the live end, following; a replaced event array is a new stream
  // (reconnect or a new run) in which the old reading position is meaningless,
  // so it deliberately re-pins to the live end as well.
  if (
    windowState.sourceFilter !== normalizedSourceFilter ||
    windowState.cacheRevision !== cacheRevision
  ) {
    pendingScrollAlignmentRef.current = "end";
    setWindowState({
      cacheRevision,
      endRow: rowBounds.end,
      lastSeenEnd: rowBounds.end,
      pinned: true,
      sourceFilter: normalizedSourceFilter,
    });
  }

  const windowEnd = windowState.pinned
    ? rowBounds.end
    : getAnchoredWindowEnd(rowBounds, windowState.endRow);
  const windowStart = Math.max(rowBounds.start, windowEnd - LOG_WINDOW_SIZE);
  const hasPrevious = windowStart > rowBounds.start;
  const hasNext = windowEnd < rowBounds.end;
  const renderedRows = groupFileRowWindow(rowIndex, windowStart, windowEnd);

  const captureScrollWindowAnchor = (): ScrollWindowAnchor | null => {
    const container = scrollRef.current;
    if (!container) return null;
    const rows = Array.from(container.querySelectorAll<HTMLElement>("[data-log-entry-id]"));
    const firstVisibleIndex = rows.findIndex(
      (row) => row.offsetTop + Math.max(row.offsetHeight, 1) > container.scrollTop,
    );
    const index = firstVisibleIndex >= 0 ? firstVisibleIndex : rows.length - 1;
    const row = rows[index];
    const renderedRow = renderedRows[index];
    if (!row || !renderedRow) return null;
    return {
      entryId: renderedRow.entry.id,
      pixelOffset: row.offsetTop - container.scrollTop,
      // Grouped FILE rows compress the visual list, so the underlying row
      // comes from the rendered row itself, not from windowStart + index.
      row: renderedRow.firstRow,
    };
  };

  // Unpinning snapshots the live end so later arrivals can be counted. While
  // already unpinned, only the window's own end counts as seen: paging forward
  // to the tail catches the reader up, paging back into history keeps the
  // snapshot instead of forfeiting the unseen count.
  const unpinnedWindow =
    (endRow: number) =>
    (current: LogWindowState): LogWindowState => ({
      cacheRevision,
      endRow,
      lastSeenEnd: current.pinned ? rowBounds.end : Math.max(current.lastSeenEnd, endRow),
      pinned: false,
      sourceFilter: normalizedSourceFilter,
    });

  const showPreviousWindow = () => {
    if (!hasPrevious) return;
    setWindowState(unpinnedWindow(windowStart));
  };

  const showNextWindow = () => {
    if (!hasNext) return;
    setWindowState(unpinnedWindow(Math.min(rowBounds.end, windowEnd + LOG_WINDOW_SIZE)));
  };

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    onScroll?.(event);
    const container = scrollRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const isAtRenderedBottom = distanceFromBottom <= 50;

    // Paging and pin state are user-gesture-only: the echo of our own
    // scrollTop write must change neither. In the edge branches, an anchor
    // restore that clamps to an edge would re-window again and the log
    // ping-pongs forever; in the pin-state update, a tail-write echo
    // processed after the next arrival already grew the content reads the
    // taller geometry as "away from the bottom" and unpins a follower
    // mid-stream. Every position the writes produce already matches the pin
    // state set by the action that requested them.
    if (programmaticScrollRef.current) {
      programmaticScrollRef.current = false;
      return;
    }

    if (container.scrollTop <= 50 && hasPrevious) {
      const anchor = captureScrollWindowAnchor();
      if (!anchor) return;
      pendingWindowAnchorRef.current = anchor;
      setWindowState(unpinnedWindow(Math.min(rowBounds.end, anchor.row + 1)));
      return;
    }

    if (isAtRenderedBottom && hasNext) {
      const anchor = captureScrollWindowAnchor();
      if (!anchor) return;
      pendingWindowAnchorRef.current = anchor;
      // Reaching the end of the rendered window is not reaching the live end:
      // the reader is still looking at history, so this re-window never pins.
      setWindowState(unpinnedWindow(Math.min(rowBounds.end, anchor.row + LOG_WINDOW_SIZE)));
      return;
    }

    const nextPinned = isAtRenderedBottom && !hasNext;
    setWindowState((current) =>
      current.cacheRevision === cacheRevision &&
      current.endRow === windowEnd &&
      current.pinned === nextPinned &&
      current.sourceFilter === normalizedSourceFilter
        ? current
        : {
            cacheRevision,
            endRow: windowEnd,
            // Pinned means the reader is at the live end, so the seen mark
            // tracks it; the step away from pinned leaves that end as the
            // snapshot later arrivals are counted against.
            lastSeenEnd: nextPinned || current.pinned ? rowBounds.end : current.lastSeenEnd,
            pinned: nextPinned,
            sourceFilter: normalizedSourceFilter,
          },
    );
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: windowState is the commit trigger for aligning a newly rendered log window; the pending alignment is stored in a ref.
  useLayoutEffect(() => {
    const alignment = pendingScrollAlignmentRef.current;
    const anchor = pendingWindowAnchorRef.current;
    const container = scrollRef.current;
    if (!container) return;
    if (anchor) {
      pendingWindowAnchorRef.current = null;
      const rows = Array.from(container.querySelectorAll<HTMLElement>("[data-log-entry-id]"));
      // A FILE burst split by the old window boundary merges into one group once
      // the earlier window loads, so the captured id is no longer rendered. The
      // group whose row span covers the captured row is the same place.
      const spanIndex = renderedRows.findIndex(
        (rendered) =>
          anchor.row >= rendered.firstRow && anchor.row < rendered.firstRow + rendered.rowCount,
      );
      const anchoredRow =
        rows.find((row) => row.dataset.logEntryId === anchor.entryId) ?? rows[spanIndex];
      if (anchoredRow) {
        writeScrollTop(
          programmaticScrollRef,
          container,
          anchoredRow.offsetTop - anchor.pixelOffset,
        );
      }
    }
    if (!alignment) return;
    pendingScrollAlignmentRef.current = null;
    writeScrollTop(
      programmaticScrollRef,
      container,
      alignment === "start" ? 0 : container.scrollHeight,
    );
  }, [windowState]);

  const tailRowProps =
    streamState === null
      ? null
      : {
          state: streamState,
          agents,
          startTime,
          lastEventAt,
          sourceFilter: normalizedSourceFilter,
        };

  const tailEvent = getEventRowTail(rowIndex);
  const latestEntry = convertEventRowWindow(
    rowIndex,
    Math.max(rowBounds.start, rowBounds.end - 1),
    rowBounds.end,
  ).at(-1);

  const pinned = windowState.pinned;
  const unseenCount = pinned ? 0 : rowBounds.end - windowState.lastSeenEnd;

  useEffect(() => {
    if (!pinned || !tailEvent) return;
    const container = scrollRef.current;
    if (container) {
      writeScrollTop(programmaticScrollRef, container, container.scrollHeight);
    }
  }, [pinned, tailEvent]);

  const jumpToLatest = () => {
    pendingScrollAlignmentRef.current = "end";
    setWindowState({
      cacheRevision,
      endRow: rowBounds.end,
      lastSeenEnd: rowBounds.end,
      pinned: true,
      sourceFilter: normalizedSourceFilter,
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    // Report the top edge only when the log has nothing left to give: someone is
    // listening, the scroll is at the top and no earlier window is paged out.
    // Claiming the key stops the container's own 40px scroll from running after
    // it, so an unheard boundary has to leave the key to the scroller. A
    // modified or bubbled ArrowUp is not this move: moving focus to another zone
    // is the one thing in here that must not fire on someone else's key.
    if (
      event.key === "ArrowUp" &&
      onTopBoundaryReached &&
      !hasModifierKey(event) &&
      event.target === event.currentTarget &&
      !hasPrevious &&
      scrollRef.current?.scrollTop === 0
    ) {
      event.preventDefault();
      onTopBoundaryReached();
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      pendingScrollAlignmentRef.current = "start";
      setWindowState(unpinnedWindow(Math.min(rowBounds.end, rowBounds.start + LOG_WINDOW_SIZE)));
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      jumpToLatest();
      return;
    }

    if (event.key === "PageUp") {
      event.preventDefault();
      showPreviousWindow();
      return;
    }

    if (event.key === "PageDown") {
      event.preventDefault();
      showNextWindow();
    }
  };

  return (
    <>
      <ScrollArea
        ref={scrollRef}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        role="log"
        aria-live="off"
        aria-label="Activity log"
        className={cn("flex-1 font-mono text-sm leading-relaxed", className)}
        {...props}
      >
        <div className="space-y-1 p-2">
          {renderedRows.map(({ entry }) => (
            <LogEntry
              key={entry.id}
              data-log-entry-id={entry.id}
              timestamp={entry.timestamp}
              tag={entry.tag}
              tagType={entry.tagType}
              source={entry.source}
              message={entry.message}
              isWarning={entry.isWarning}
              isError={entry.isError}
            />
          ))}
        </div>
      </ScrollArea>
      {/* Outside the scrolling content: the tail row is pinned to the pane so
          "is it alive?" stays answerable without scrolling to the bottom. */}
      {unseenCount > 0 && <NewEntriesRow count={unseenCount} onJump={jumpToLatest} />}
      {tailRowProps && <LiveTailRow {...tailRowProps} />}
      <ActivityLogAnnouncement
        tailEvent={tailEvent}
        latestEntry={latestEntry}
        sourceFilter={normalizedSourceFilter}
        tailStatus={tailRowProps ? buildTailStatus(tailRowProps) : null}
        enabled={streamState !== null}
      />
    </>
  );
}
