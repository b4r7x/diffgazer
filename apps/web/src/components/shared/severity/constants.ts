import type { ReviewSeverity } from "@diffgazer/core/schemas/review";

export interface SeverityConfig {
  icon: string;
  color: string;
  borderColor: string;
}

export const SEVERITY_CONFIG: Record<ReviewSeverity, SeverityConfig> = {
  blocker: { icon: "\u2716", color: "text-error-text", borderColor: "border-error" },
  high: { icon: "\u25B2", color: "text-warning-text", borderColor: "border-warning" },
  medium: { icon: "\u25CF", color: "text-severity-medium", borderColor: "border-severity-medium" },
  low: { icon: "\u25CB", color: "text-info-text", borderColor: "border-info" },
  nit: { icon: "\u00B7", color: "text-muted-foreground", borderColor: "border-muted-foreground" },
};

export const BAR_FILLED_CHAR = "\u2588";

export const BAR_EMPTY_CHAR = "\u2591";

export const DEFAULT_BAR_WIDTH = 20;
