import type { RunIdLookup } from "@diffgazer/core/format";
import {
  buildHistoryWarningMessages,
  HISTORY_WARNING_TARGET_SAMPLE_SIZE,
  type HistoryWarningSummary,
} from "@diffgazer/core/review";
import { hasModifierKey } from "@diffgazer/keys";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import type { KeyboardEvent, RefObject } from "react";

const HISTORY_WARNING_SCROLL_HINT_ID = "history-warning-scroll-hint";

export function HistoryWarnings({
  summary,
  runIdLookup,
  targetIds,
  warningRef,
  onFocus,
  onHandOffToChrome,
}: {
  summary: HistoryWarningSummary;
  runIdLookup: RunIdLookup;
  targetIds: readonly string[];
  warningRef: RefObject<HTMLDivElement | null>;
  onFocus: () => void;
  onHandOffToChrome: () => void;
}) {
  const messages = buildHistoryWarningMessages(summary, runIdLookup, {
    maxTargetIds: HISTORY_WARNING_TARGET_SAMPLE_SIZE,
  });

  // The region is the top of the page, so an ArrowUp that cannot scroll any
  // further hands focus to the header Back button; below the top the key keeps
  // scrolling the region. Modified arrows stay native, mirroring the
  // ScrollArea's own scrolling guard.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (hasModifierKey(event)) return;
    if (event.key === "ArrowUp" && event.currentTarget.scrollTop === 0) {
      event.preventDefault();
      onHandOffToChrome();
    }
  };

  // Keep the live copy separate from the scrollable detail so screen readers do
  // not announce every ID in a large warning batch.
  return (
    <div className="shrink-0 break-words text-sm text-warning-text">
      <div
        aria-atomic="true"
        aria-live="polite"
        className={messages.length > 0 ? "mb-1" : undefined}
      >
        {messages.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </div>
      {targetIds.length > 0 ? (
        <ScrollArea
          ref={warningRef}
          aria-label="History warnings"
          aria-describedby={HISTORY_WARNING_SCROLL_HINT_ID}
          className="max-h-24 space-y-1"
          onFocus={onFocus}
          onKeyDown={handleKeyDown}
        >
          <p id={HISTORY_WARNING_SCROLL_HINT_ID} className="sr-only">
            Focus this region to scroll warnings with Arrow Up, Arrow Down, Page Up, Page Down,
            Home, or End.
          </p>
          <ul aria-label="All affected review IDs">
            {targetIds.map((id) => (
              <li key={id}>{`${runIdLookup.get(id) ?? id} ${id}`}</li>
            ))}
          </ul>
        </ScrollArea>
      ) : null}
    </div>
  );
}
