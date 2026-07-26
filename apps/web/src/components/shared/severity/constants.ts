import type { ReviewSeverity } from "@diffgazer/core/schemas/review";

export interface SeverityConfig {
  color: string;
  borderColor: string;
}

export const SEVERITY_CONFIG: Record<ReviewSeverity, SeverityConfig> = {
  blocker: { color: "text-severity-blocker", borderColor: "border-severity-blocker" },
  high: { color: "text-severity-high", borderColor: "border-severity-high" },
  medium: { color: "text-severity-medium", borderColor: "border-severity-medium" },
  low: { color: "text-severity-low", borderColor: "border-severity-low" },
  nit: { color: "text-severity-nit", borderColor: "border-severity-nit" },
};

export const BAR_FILLED_CHAR = "\u2588";

export const BAR_EMPTY_CHAR = "\u2591";

export const DEFAULT_BAR_WIDTH = 20;
