import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

type SecurityBadgeType = "CWE" | "OWASP" | "CVE";

interface SecurityBadgeProps {
  type: SecurityBadgeType;
  code: string;
}

export function SecurityBadge({ type, code }: SecurityBadgeProps): ReactElement {
  const { colors } = useTheme();

  return (
    <Text color={colors.ui.error}>
      [{type}-{code}]
    </Text>
  );
}

interface SecurityBadgeGroupProps {
  badges: Array<{ type: SecurityBadgeType; code: string }>;
}

export function SecurityBadgeGroup({ badges }: SecurityBadgeGroupProps): ReactElement | null {
  if (badges.length === 0) return null;

  return (
    <Box gap={1}>
      {badges.map((badge, i) => (
        <SecurityBadge
          key={`${badge.type}-${badge.code}-${i}`}
          type={badge.type}
          code={badge.code}
        />
      ))}
    </Box>
  );
}
