import type { ReactElement } from "react";
import { Text } from "ink";
import type { TriageSeverity } from "@repo/schemas/triage";
import { SEVERITY_LABELS } from "@repo/schemas/ui";
import { useTheme } from "../../../hooks/use-theme.js";

export interface SeverityFilterButtonProps {
  severity: TriageSeverity;
  count: number;
  isActive: boolean;
  isFocused?: boolean;
  onClick?: () => void;
}

export function SeverityFilterButton({
  severity,
  count,
  isActive,
  isFocused = false,
  // onClick is accepted for API consistency but not used in CLI (no mouse support)
  onClick: _onClick,
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
