import type { DisplayStatus } from "@diffgazer/schemas/config";
import type { BadgeVariant } from "@diffgazer/schemas/ui";
export type { DisplayStatus, BadgeVariant };

export interface DisplayStatusConfig {
  label: string;
  badgeLabel: string;
  badgeVariant: BadgeVariant;
}

const DISPLAY_STATUS_CONFIG: Record<DisplayStatus, DisplayStatusConfig> = {
  active: { label: "Active", badgeLabel: "active", badgeVariant: "success" },
  configured: { label: "Configured", badgeLabel: "configured", badgeVariant: "info" },
  "needs-key": { label: "Needs Key", badgeLabel: "needs key", badgeVariant: "neutral" },
} as const;

export function getDisplayStatusLabel(status: DisplayStatus): string {
  return DISPLAY_STATUS_CONFIG[status].label;
}

export function getDisplayStatusBadge(status: DisplayStatus): { label: string; variant: BadgeVariant } {
  const config = DISPLAY_STATUS_CONFIG[status];
  return { label: config.badgeLabel, variant: config.badgeVariant };
}

export function getProviderStatus(
  isLoading: boolean,
  isConfigured: boolean,
): "active" | "idle" {
  if (isLoading) return "idle";
  return isConfigured ? "active" : "idle";
}

export function getProviderDisplay(provider?: string, model?: string): string {
  if (!provider) return "Not configured";
  if (model) return `${provider} / ${model}`;
  return provider;
}
