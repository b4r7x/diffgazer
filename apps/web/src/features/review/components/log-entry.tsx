import { formatTimestamp } from '@stargazer/core/format';
import { cn } from '@/utils/cn';
import type { LogTagType } from '@stargazer/schemas/ui';
import { Badge } from '@/components/ui/badge';

export type { LogTagType };

const TAG_VARIANTS: Record<LogTagType, { variant: "success" | "warning" | "error" | "info" | "neutral"; className?: string }> = {
  system: { variant: "neutral" },
  tool: { variant: "info" },
  lens: { variant: "info" },
  warning: { variant: "warning" },
  error: { variant: "error" },
  agent: { variant: "info" },
  thinking: { variant: "neutral", className: "opacity-70" },
};

export interface LogEntryProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  timestamp: Date | string;
  tag: string;
  tagType?: LogTagType;
  source?: string;
  message: React.ReactNode;
  isWarning?: boolean;
  isError?: boolean;
}

export function LogEntry({
  timestamp,
  tag,
  tagType,
  source,
  message,
  isWarning,
  isError,
  className,
}: LogEntryProps) {
  const tagStyle = TAG_VARIANTS[tagType ?? "system"];
  return (
    <div className={cn('font-mono text-sm leading-relaxed', className)}>
      <span className="text-tui-muted">[{formatTimestamp(timestamp)}]</span>{' '}
      <Badge
        variant={tagStyle.variant}
        size="sm"
        className={cn("mx-1 min-w-[48px] justify-center", tagStyle.className)}
      >
        {tag}
      </Badge>
      {source && (
        <>
          <span className="font-bold text-tui-fg">{source}</span>
          <span className="text-tui-muted"> → </span>
        </>
      )}
      <span className={cn('text-tui-muted', isWarning && 'text-tui-yellow', isError && 'text-tui-red')}>
        {message}
      </span>
    </div>
  );
}
