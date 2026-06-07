import type { LogEntryData as BaseLogEntryData } from "@diffgazer/core/schemas/presentation";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { cn } from "@diffgazer/ui/lib/utils";
import { useEffect, useRef, useState } from "react";
import { LogEntry } from "./log-entry";

export interface LogEntryData extends Omit<BaseLogEntryData, "message"> {
  message: React.ReactNode;
}

export interface ActivityLogProps extends React.HTMLAttributes<HTMLDivElement> {
  entries: LogEntryData[];
  showCursor?: boolean;
  autoScroll?: boolean;
}

export function ActivityLog({
  entries,
  showCursor,
  autoScroll = true,
  className,
  ...props
}: ActivityLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setIsNearBottom(distanceFromBottom <= 50);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: `entries` is an intentional re-run trigger — the effect must scroll to the newest entry whenever the list changes, even though it does not read `entries` directly.
  useEffect(() => {
    if (autoScroll && isNearBottom && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, autoScroll, isNearBottom]);

  return (
    <ScrollArea
      ref={scrollRef}
      onScroll={handleScroll}
      role="log"
      aria-live="polite"
      aria-label="Activity log"
      className={cn("flex-1 font-mono text-sm leading-relaxed", className)}
      {...props}
    >
      <div className="space-y-1 p-2">
        {entries.map((entry) => (
          <LogEntry
            key={entry.id}
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
          <span className="inline-block h-4 w-2 bg-tui-fg cursor-blink" aria-hidden="true" />
        )}
      </div>
    </ScrollArea>
  );
}
