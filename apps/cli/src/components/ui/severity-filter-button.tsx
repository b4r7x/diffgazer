import type { ReactElement } from "react";
import { Text } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

export type SeverityLevel = "blocker" | "high" | "medium" | "low" | "nit";

const SEVERITY_LABELS: Record<SeverityLevel, string> = {
  blocker: "BLOCKER",
  high: "HIGH",
  medium: "MED",
  low: "LOW",
  nit: "NIT",
};

export interface SeverityFilterButtonProps {
  severity: SeverityLevel;
  count: number;
  isActive: boolean;
  isFocused?: boolean;
}

export function SeverityFilterButton({
  severity,
  count,
  isActive,
  isFocused = false,
}: SeverityFilterButtonProps): ReactElement {
  const { colors } = useTheme();

  const color = colors.severity[severity];
  const label = SEVERITY_LABELS[severity];

  return (
    <Text
      color={isActive ? undefined : color}
      backgroundColor={isActive ? color : undefined}
      inverse={isFocused && !isActive}
      bold={isActive}
    >
      [{label} {count}]
    </Text>
  );
}
