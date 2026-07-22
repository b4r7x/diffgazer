import { formatTimestamp } from "@diffgazer/core/format";
import { type LogTagType, TAG_BADGE_VARIANTS } from "@diffgazer/core/schemas/presentation";
import { Badge } from "@diffgazer/ui/components/badge";
import { cn } from "@diffgazer/ui/lib/utils";

const TAG_CLASS_NAMES: Partial<Record<LogTagType, string>> = {
  thinking: "opacity-70",
};

export interface LogEntryProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
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
  ...props
}: LogEntryProps) {
  const resolvedTagType = tagType ?? "system";
  return (
    <div className={cn("min-w-0 font-mono text-sm leading-relaxed", className)} {...props}>
      <span className="text-muted-foreground">[{formatTimestamp(timestamp)}]</span>{" "}
      <Badge
        variant={TAG_BADGE_VARIANTS[resolvedTagType] ?? "neutral"}
        size="sm"
        className={cn("mx-1 min-w-[48px] justify-center", TAG_CLASS_NAMES[resolvedTagType])}
      >
        {tag}
      </Badge>
      {source && (
        <>
          <span className="font-bold text-foreground">{source}</span>
          <span className="text-muted-foreground"> → </span>
        </>
      )}
      <span
        className={cn(
          "wrap-anywhere text-muted-foreground",
          isWarning && "text-warning-text",
          isError && "text-error-text",
        )}
      >
        {message}
      </span>
    </div>
  );
}
