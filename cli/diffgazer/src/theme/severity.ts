import type { CliColorTokens } from "./palettes.js";

export function severityColor(severity: string, tokens: CliColorTokens): string {
  const map: Record<string, string> = {
    blocker: tokens.severityBlocker,
    high: tokens.severityHigh,
    medium: tokens.severityMedium,
    low: tokens.severityLow,
    nit: tokens.severityNit,
  };
  return map[severity] ?? tokens.muted;
}
