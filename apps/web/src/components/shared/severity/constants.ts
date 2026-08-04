import type { ReviewSeverity } from "@diffgazer/core/schemas/review";

interface SeverityConfig {
  color: string;
  borderColor: string;
  /** Rank mark drawn beside the severity word: filled from medium up, hollow below. */
  glyph: string;
}

export const SEVERITY_CONFIG: Record<ReviewSeverity, SeverityConfig> = {
  blocker: { color: "text-severity-blocker", borderColor: "border-severity-blocker", glyph: "✱" },
  high: { color: "text-severity-high", borderColor: "border-severity-high", glyph: "▲" },
  medium: { color: "text-severity-medium", borderColor: "border-severity-medium", glyph: "●" },
  low: { color: "text-severity-low", borderColor: "border-severity-low", glyph: "○" },
  nit: { color: "text-severity-nit", borderColor: "border-severity-nit", glyph: "○" },
};
