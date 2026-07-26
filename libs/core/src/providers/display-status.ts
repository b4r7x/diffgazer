import type { DisplayStatus } from "../schemas/config/index.js";
import type { BadgeVariant } from "../schemas/presentation/index.js";

const DISPLAY_STATUS_CONFIG: Record<DisplayStatus, { label: string; variant: BadgeVariant }> = {
  active: { label: "active", variant: "success" },
  configured: { label: "configured", variant: "info" },
  "needs-key": { label: "needs key", variant: "neutral" },
};

export function getDisplayStatusBadge(status: DisplayStatus): {
  label: string;
  variant: BadgeVariant;
} {
  return DISPLAY_STATUS_CONFIG[status];
}

export type ProviderDisplayStatus = "active" | "idle";

export function getProviderDisplayStatus(
  isLoading: boolean,
  isConfigured: boolean,
): ProviderDisplayStatus {
  if (isLoading) return "idle";
  return isConfigured ? "active" : "idle";
}

export function getProviderDisplay(provider?: string, model?: string): string {
  if (!provider) return "Not configured";
  if (model) return `${provider} / ${model}`;
  return provider;
}
