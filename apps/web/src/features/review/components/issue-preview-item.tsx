import { SEVERITY_LABELS } from "@diffgazer/core/schemas/presentation";
import type { ReviewSeverity } from "@diffgazer/core/schemas/review";
import { Badge } from "@diffgazer/ui/components/badge";
import { cn } from "@diffgazer/ui/lib/utils";
import { PathValue } from "@/components/shared/path-value";
import { SEVERITY_CONFIG } from "@/components/shared/severity/constants";

export interface IssuePreviewItemProps {
  title: string;
  file: string;
  line?: number | null;
  category: string;
  severity: ReviewSeverity;
  className?: string;
}

export function IssuePreviewItem({
  title,
  file,
  line,
  category,
  severity,
  className,
}: IssuePreviewItemProps) {
  const { color, borderColor } = SEVERITY_CONFIG[severity];
  const label = SEVERITY_LABELS[severity];
  const location = line == null ? file : `${file}:${line}`;

  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 w-full text-left",
        "bg-background border-b border-border last:border-b-0",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="min-w-0">
          <div className="text-sm font-bold">{title}</div>
          <PathValue value={location} className="text-xs text-muted-foreground" />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <span className="hidden sm:inline text-xs text-muted-foreground">{category}</span>
        <Badge size="sm" className={cn("text-2xs uppercase", borderColor, color, "bg-transparent")}>
          {label}
        </Badge>
      </div>
    </div>
  );
}
