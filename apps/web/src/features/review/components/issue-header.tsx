import type { IssueDetailsPresentation } from "@diffgazer/core/review";
import type { ReviewSeverity } from "@diffgazer/core/schemas/review";
import { Typography } from "@diffgazer/ui/components/typography";
import { cn } from "@diffgazer/ui/lib/utils";
import { SEVERITY_CONFIG } from "@/components/shared/severity/constants";

export interface IssueHeaderProps {
  title: string;
  severity: ReviewSeverity;
  presentation: Pick<IssueDetailsPresentation, "category" | "confidence" | "location">;
  className?: string;
}

export function IssueHeader({ title, severity, presentation, className }: IssueHeaderProps) {
  const { color: severityColor } = SEVERITY_CONFIG[severity];

  return (
    <div className={cn("mb-6", className)}>
      <Typography as="h1" size="xl" className={cn("mb-1", severityColor)}>
        <span className="sr-only">{severity} severity: </span>
        {title}
      </Typography>
      <div className="text-xs text-muted-foreground">
        Location: <span className="text-foreground">{presentation.location}</span>
      </div>
      <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
        <span>
          Category: <span className="text-foreground">{presentation.category}</span>
        </span>
        <span>
          Confidence: <span className="text-foreground">{presentation.confidence}</span>
        </span>
      </div>
    </div>
  );
}
