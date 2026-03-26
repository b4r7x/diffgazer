export type DisplayStatus = "active" | "configured" | "needs-key";

export interface DisplayStatusConfig {
  label: string;
  badgeLabel: string;
  badgeVariant: string;
}

const DISPLAY_STATUS_CONFIG: Record<DisplayStatus, DisplayStatusConfig> = {
  active: { label: "Active", badgeLabel: "active", badgeVariant: "success" },
  configured: { label: "Configured", badgeLabel: "configured", badgeVariant: "info" },
  "needs-key": { label: "Needs Key", badgeLabel: "needs key", badgeVariant: "neutral" },
} as const;

export function getDisplayStatusLabel(status: DisplayStatus): string {
  return DISPLAY_STATUS_CONFIG[status].label;
}

export function getDisplayStatusBadge(status: DisplayStatus): { label: string; variant: string } {
  const config = DISPLAY_STATUS_CONFIG[status];
  return { label: config.badgeLabel, variant: config.badgeVariant };
}
