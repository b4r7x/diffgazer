import type { ReviewSeverity } from "@stargazer/schemas/review";

export interface SeverityConfig {
  icon: string;
  color: string;
  label: string;
  borderColor: string;
}

export const SEVERITY_CONFIG: Record<ReviewSeverity, SeverityConfig> = {
  blocker: { icon: "\u2716", color: "text-tui-red", label: "BLOCKER", borderColor: "border-tui-red" },
  high: { icon: "\u25B2", color: "text-tui-yellow", label: "HIGH", borderColor: "border-tui-yellow" },
  medium: { icon: "\u25CF", color: "text-severity-medium", label: "MED", borderColor: "border-severity-medium" },
  low: { icon: "\u25CB", color: "text-tui-blue", label: "LOW", borderColor: "border-tui-blue" },
  nit: { icon: "\u00B7", color: "text-muted-foreground", label: "NIT", borderColor: "border-muted-foreground" },
};

/** Unicode filled block for bar charts */
export const BAR_FILLED_CHAR = "\u2588";

/** Unicode empty block for bar charts */
export const BAR_EMPTY_CHAR = "\u2591";

/** Default width for bar charts */
export const DEFAULT_BAR_WIDTH = 20;
