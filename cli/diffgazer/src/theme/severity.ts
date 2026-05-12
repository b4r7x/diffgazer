import type { ReviewSeverity } from "@diffgazer/core/schemas/review";
import type { CliColorTokens } from "./palettes.js";

export function severityColor(severity: ReviewSeverity, tokens: CliColorTokens): string {
  const map: Record<ReviewSeverity, string> = {
    blocker: tokens.severityBlocker,
    high: tokens.severityHigh,
    medium: tokens.severityMedium,
    low: tokens.severityLow,
    nit: tokens.severityNit,
  };
  return map[severity];
}
