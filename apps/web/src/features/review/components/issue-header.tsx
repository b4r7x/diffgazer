import { cn } from "@/utils/cn";
import type { ReviewSeverity } from "@diffgazer/schemas/review";
import { SEVERITY_CONFIG } from "@/components/ui/severity/constants";

export interface IssueHeaderProps {
  title: string;
  severity: ReviewSeverity;
  file: string;
  line: number;
  className?: string;
}

export function IssueHeader({ title, severity, file, line, className }: IssueHeaderProps) {
  const severityColor = SEVERITY_CONFIG[severity]?.color ?? "text-tui-muted";

  return (
    <div className={cn("mb-6", className)}>
      <h1 className={cn("text-xl font-bold mb-1", severityColor)}>
        {title}
      </h1>
      <div className="text-xs text-tui-muted">
        Location: <span className="text-tui-fg">{file}:{line}</span>
      </div>
    </div>
  );
}
