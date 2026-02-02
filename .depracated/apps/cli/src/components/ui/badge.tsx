import type { ReactElement } from "react";
import { Text } from "ink";
import type { TriageSeverity } from "@repo/schemas/triage";
import { useTheme } from "../../hooks/use-theme.js";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "muted";

interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
  color?: string;
  bold?: boolean;
}

export function Badge({
  text,
  variant = "default",
  color,
  bold = true,
}: BadgeProps): ReactElement {
  const { colors } = useTheme();

  const variantColors: Record<BadgeVariant, string> = {
    default: colors.ui.text,
    success: colors.ui.success,
    warning: colors.ui.warning,
    error: colors.ui.error,
    info: colors.ui.info,
    muted: colors.ui.textMuted,
  };

  const displayColor = color ?? variantColors[variant];

  return (
    <Text color={displayColor} bold={bold}>
      [{text}]
    </Text>
  );
}

interface SeverityBadgeProps {
  severity: TriageSeverity;
}

export function SeverityBadge({ severity }: SeverityBadgeProps): ReactElement {
  const { colors } = useTheme();

  return (
    <Text color={colors.severity[severity]} bold>
      [{severity.toUpperCase()}]
    </Text>
  );
}

type StatusLevel = "pending" | "running" | "complete" | "failed" | "skipped";

const STATUS_LABELS: Record<StatusLevel, string> = {
  pending: "PENDING",
  running: "RUNNING",
  complete: "DONE",
  failed: "FAILED",
  skipped: "SKIP",
};

interface StatusBadgeProps {
  status: StatusLevel;
}

export function StatusBadge({ status }: StatusBadgeProps): ReactElement {
  const { colors } = useTheme();

  return (
    <Text color={colors.status[status]}>
      [{STATUS_LABELS[status]}]
    </Text>
  );
}
