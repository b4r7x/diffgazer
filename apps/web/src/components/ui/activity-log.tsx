'use client';

import { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import { LogEntry, type LogTagType } from './log-entry';
import { ScrollArea } from './scroll-area';

export interface LogEntryData {
  id: string;
  timestamp: Date | string;
  tag: string;
  tagType?: LogTagType;
  message: React.ReactNode;
  isWarning?: boolean;
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
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, autoScroll]);

  return (
    <ScrollArea
      className={cn(
        'flex-1 overflow-hidden font-mono text-sm leading-relaxed scrollbar-hide',
        className
      )}
      {...props}
    >
      <div className="space-y-1 p-2">
        {entries.map((entry) => (
          <LogEntry
            key={entry.id}
            timestamp={entry.timestamp}
            tag={entry.tag}
            tagType={entry.tagType}
            message={entry.message}
            isWarning={entry.isWarning}
          />
        ))}
        {showCursor && (
          <span className="inline-block h-4 w-2 bg-tui-fg cursor-blink" />
        )}
        <div ref={endRef} />
      </div>
    </ScrollArea>
  );
}
