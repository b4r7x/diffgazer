import type { ReviewSeverity } from "@diffgazer/core/schemas/review";

export interface SeverityConfig {
  icon: string;
  color: string;
  borderColor: string;
}

export const SEVERITY_CONFIG: Record<ReviewSeverity, SeverityConfig> = {
  blocker: {
    icon: "\u2716",
    color: "text-severity-blocker",
    borderColor: "border-severity-blocker",
  },
  high: { icon: "\u25B2", color: "text-severity-high", borderColor: "border-severity-high" },
  medium: { icon: "\u25CF", color: "text-severity-medium", borderColor: "border-severity-medium" },
  low: { icon: "\u25CB", color: "text-severity-low", borderColor: "border-severity-low" },
  nit: { icon: "\u00B7", color: "text-severity-nit", borderColor: "border-severity-nit" },
};

export const BAR_FILLED_CHAR = "\u2588";

export const BAR_EMPTY_CHAR = "\u2591";

export const DEFAULT_BAR_WIDTH = 20;
