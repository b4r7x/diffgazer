import type { ReviewSeverity } from "@diffgazer/core/schemas/review";
import { Typography } from "@diffgazer/ui/components/typography";
import { cn } from "@diffgazer/ui/lib/utils";
import { SEVERITY_CONFIG } from "@/components/shared/severity/constants";

export interface IssueHeaderProps {
  title: string;
  severity: ReviewSeverity;
  file: string;
  line: number;
  className?: string;
}

export function IssueHeader({ title, severity, file, line, className }: IssueHeaderProps) {
  const { color: severityColor } = SEVERITY_CONFIG[severity];

  return (
    <div className={cn("mb-6", className)}>
      <Typography as="h1" size="xl" className={cn("mb-1", severityColor)}>
        <span className="sr-only">{severity} severity: </span>
        {title}
      </Typography>
      <div className="text-xs text-muted-foreground">
        Location:{" "}
        <span className="text-foreground">
          {file}:{line}
        </span>
      </div>
    </div>
  );
}
