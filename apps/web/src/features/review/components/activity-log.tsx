import type { ReviewEvent } from "@diffgazer/core/review";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { cn } from "@diffgazer/ui/lib/utils";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  convertEventRowWindow,
  deriveEventRowIndex,
  type EventRowIndex,
  getAnchoredWindowEnd,
  getEventRowBounds,
  getEventRowTail,
  LOG_WINDOW_SIZE,
} from "./event-row-index";
import { LogEntry } from "./log-entry";

export interface ActivityLogProps extends React.HTMLAttributes<HTMLDivElement> {
  events: readonly ReviewEvent[];
  sourceFilter?: string | null;
  showCursor?: boolean;
}

interface LogWindowState {
  cacheRevision: number;
  endRow: number;
  isNearBottom: boolean;
  sourceFilter: string | null;
}

type ScrollAlignment = "end" | "start";

interface ScrollWindowAnchor {
  entryId: string;
  pixelOffset: number;
  row: number;
}

interface LogAnnouncement {
  id: string;
  message: string;
}

const ACTIVITY_ANNOUNCEMENT_DELAY_MS = 750;

export function ActivityLog({
  events,
  sourceFilter,
  showCursor,
  className,
  onKeyDown,
  onScroll,
  ...props
}: ActivityLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingScrollAlignmentRef = useRef<ScrollAlignment | null>(null);
  const pendingWindowAnchorRef = useRef<ScrollWindowAnchor | null>(null);
  const committedRowIndexRef = useRef<EventRowIndex | null>(null);
  const announcementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAnnouncementRef = useRef<LogAnnouncement | null>(null);
  const [announcement, setAnnouncement] = useState<LogAnnouncement | null>(null);
  const normalizedSourceFilter = sourceFilter || null;
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
    isNearBottom: true,
    sourceFilter: normalizedSourceFilter,
  }));
  const isCurrentWindow =
    windowState.cacheRevision === cacheRevision &&
    windowState.sourceFilter === normalizedSourceFilter;
  const shouldRenderTail = !isCurrentWindow || windowState.isNearBottom;
  const windowEnd = shouldRenderTail
    ? rowBounds.end
    : getAnchoredWindowEnd(rowBounds, windowState.endRow);
  const windowStart = Math.max(rowBounds.start, windowEnd - LOG_WINDOW_SIZE);
  const hasPrevious = windowStart > rowBounds.start;
  const hasNext = windowEnd < rowBounds.end;
  const entries = convertEventRowWindow(rowIndex, windowStart, windowEnd);

  const captureScrollWindowAnchor = (): ScrollWindowAnchor | null => {
    const container = scrollRef.current;
    if (!container) return null;
    const rows = Array.from(container.querySelectorAll<HTMLElement>("[data-log-entry-id]"));
    const firstVisibleIndex = rows.findIndex(
      (row) => row.offsetTop + Math.max(row.offsetHeight, 1) > container.scrollTop,
    );
    const index = firstVisibleIndex >= 0 ? firstVisibleIndex : rows.length - 1;
    const row = rows[index];
    const entry = entries[index];
    if (!row || !entry) return null;
    return {
      entryId: entry.id,
      pixelOffset: row.offsetTop - container.scrollTop,
      row: windowStart + index,
    };
  };

  const showPreviousWindow = () => {
    if (!hasPrevious) return;
    setWindowState({
      cacheRevision,
      endRow: windowStart,
      isNearBottom: false,
      sourceFilter: normalizedSourceFilter,
    });
  };

  const showNextWindow = () => {
    if (!hasNext) return;
    const nextEnd = Math.min(rowBounds.end, windowEnd + LOG_WINDOW_SIZE);
    setWindowState({
      cacheRevision,
      endRow: nextEnd,
      isNearBottom: nextEnd === rowBounds.end,
      sourceFilter: normalizedSourceFilter,
    });
  };

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    onScroll?.(event);
    const container = scrollRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const isAtRenderedBottom = distanceFromBottom <= 50;

    if (container.scrollTop <= 50 && hasPrevious) {
      const anchor = captureScrollWindowAnchor();
      if (!anchor) return;
      pendingWindowAnchorRef.current = anchor;
      setWindowState({
        cacheRevision,
        endRow: Math.min(rowBounds.end, anchor.row + 1),
        isNearBottom: false,
        sourceFilter: normalizedSourceFilter,
      });
      return;
    }

    if (isAtRenderedBottom && hasNext) {
      const anchor = captureScrollWindowAnchor();
      if (!anchor) return;
      const nextEnd = Math.min(rowBounds.end, anchor.row + LOG_WINDOW_SIZE);
      pendingWindowAnchorRef.current = anchor;
      setWindowState({
        cacheRevision,
        endRow: nextEnd,
        isNearBottom: nextEnd === rowBounds.end,
        sourceFilter: normalizedSourceFilter,
      });
      return;
    }

    const nextIsNearBottom = isAtRenderedBottom && !hasNext;
    setWindowState((current) =>
      current.cacheRevision === cacheRevision &&
      current.endRow === windowEnd &&
      current.isNearBottom === nextIsNearBottom &&
      current.sourceFilter === normalizedSourceFilter
        ? current
        : {
            cacheRevision,
            endRow: windowEnd,
            isNearBottom: nextIsNearBottom,
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
      const anchoredRow = Array.from(
        container.querySelectorAll<HTMLElement>("[data-log-entry-id]"),
      ).find((row) => row.dataset.logEntryId === anchor.entryId);
      if (anchoredRow) {
        container.scrollTop = anchoredRow.offsetTop - anchor.pixelOffset;
      }
    }
    if (!alignment) return;
    pendingScrollAlignmentRef.current = null;
    container.scrollTop = alignment === "start" ? 0 : container.scrollHeight;
  }, [windowState]);

  const tailToken = getEventRowTail(rowIndex);
  const latestEntry = convertEventRowWindow(
    rowIndex,
    Math.max(rowBounds.start, rowBounds.end - 1),
    rowBounds.end,
  ).at(-1);
  const announcedTailRef = useRef(tailToken);
  const announcedSourceFilterRef = useRef(normalizedSourceFilter);

  useEffect(() => {
    if (announcedSourceFilterRef.current !== normalizedSourceFilter) {
      announcedSourceFilterRef.current = normalizedSourceFilter;
      announcedTailRef.current = tailToken;
      pendingAnnouncementRef.current = null;
      if (announcementTimerRef.current) {
        clearTimeout(announcementTimerRef.current);
        announcementTimerRef.current = null;
      }
      return;
    }
    if (announcedTailRef.current === tailToken) return;
    announcedTailRef.current = tailToken;
    if (!showCursor || !latestEntry) return;
    pendingAnnouncementRef.current = { id: latestEntry.id, message: latestEntry.message };
    if (announcementTimerRef.current) return;
    announcementTimerRef.current = setTimeout(() => {
      announcementTimerRef.current = null;
      const announcement = pendingAnnouncementRef.current;
      pendingAnnouncementRef.current = null;
      if (announcement) setAnnouncement(announcement);
    }, ACTIVITY_ANNOUNCEMENT_DELAY_MS);
  }, [latestEntry, normalizedSourceFilter, showCursor, tailToken]);

  useEffect(
    () => () => {
      if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!shouldRenderTail || !tailToken) return;
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [shouldRenderTail, tailToken]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.key === "Home") {
      event.preventDefault();
      pendingScrollAlignmentRef.current = "start";
      setWindowState({
        cacheRevision,
        endRow: Math.min(rowBounds.end, rowBounds.start + LOG_WINDOW_SIZE),
        isNearBottom: false,
        sourceFilter: normalizedSourceFilter,
      });
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      pendingScrollAlignmentRef.current = "end";
      setWindowState({
        cacheRevision,
        endRow: rowBounds.end,
        isNearBottom: true,
        sourceFilter: normalizedSourceFilter,
      });
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
          {entries.map((entry) => (
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
          {showCursor && (
            <span className="inline-block h-4 w-2 bg-foreground cursor-blink" aria-hidden="true" />
          )}
        </div>
      </ScrollArea>
      <output aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement && <span key={announcement.id}>{announcement.message}</span>}
      </output>
    </>
  );
}
