import type { ReviewSeverity } from "@diffgazer/core/schemas/review";

export interface SeverityConfig {
  icon: string;
  color: string;
  borderColor: string;
}

export const SEVERITY_CONFIG: Record<ReviewSeverity, SeverityConfig> = {
  blocker: { icon: "\u2716", color: "text-tui-red", borderColor: "border-tui-red" },
  high: { icon: "\u25B2", color: "text-tui-yellow", borderColor: "border-tui-yellow" },
  medium: { icon: "\u25CF", color: "text-severity-medium", borderColor: "border-severity-medium" },
  low: { icon: "\u25CB", color: "text-tui-blue", borderColor: "border-tui-blue" },
  nit: { icon: "\u00B7", color: "text-muted-foreground", borderColor: "border-muted-foreground" },
};

export const BAR_FILLED_CHAR = "\u2588";

export const BAR_EMPTY_CHAR = "\u2591";

export const DEFAULT_BAR_WIDTH = 20;
