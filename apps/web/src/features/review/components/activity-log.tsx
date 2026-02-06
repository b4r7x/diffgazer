import { useEffect, useRef, useCallback, useState } from 'react';
import { cn } from '@/utils/cn';
import { LogEntry } from './log-entry';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { LogEntryData as BaseLogEntryData } from '@stargazer/schemas/ui';

// Extend with React.ReactNode for message field
export interface LogEntryData extends Omit<BaseLogEntryData, 'message'> {
  message: React.ReactNode;
}

export interface ActivityLogProps
  extends React.HTMLAttributes<HTMLDivElement> {
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

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setIsNearBottom(distanceFromBottom <= 50);
  }, []);

  useEffect(() => {
    if (autoScroll && isNearBottom && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, autoScroll, isNearBottom]);

  return (
    <ScrollArea
      ref={scrollRef}
      onScroll={handleScroll}
      className={cn('flex-1 font-mono text-sm leading-relaxed', className)}
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
          <span className="inline-block h-4 w-2 bg-tui-fg cursor-blink" />
        )}
      </div>
    </ScrollArea>
  );
}
