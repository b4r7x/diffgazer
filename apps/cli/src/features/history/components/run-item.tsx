import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { Badge } from "../../../components/ui/badge.js";
import { useTheme } from "../../../theme/theme-context.js";

export interface RunItemProps {
  date: string;
  issueCount: number;
  severities: Array<{ severity: string; count: number }>;
  isHighlighted?: boolean;
}

const severityVariant: Record<string, "error" | "warning" | "info" | "neutral"> = {
  critical: "error",
  high: "error",
  medium: "warning",
  low: "info",
};

export function RunItem({
  date,
  issueCount,
  severities,
  isHighlighted = false,
}: RunItemProps): ReactElement {
  const { tokens } = useTheme();

  const visible = severities.filter((s) => s.count > 0);

  return (
    <Box flexDirection="row" gap={1}>
      <Text
        color={isHighlighted ? tokens.fg : tokens.muted}
        bold={isHighlighted}
        inverse={isHighlighted}
      >
        {date}
      </Text>
      <Text
        color={isHighlighted ? tokens.fg : undefined}
        inverse={isHighlighted}
      >
        {issueCount} issue{issueCount !== 1 ? "s" : ""}
      </Text>
      {visible.map((s) => (
        <Badge key={s.severity} variant={severityVariant[s.severity] ?? "neutral"}>
          {`${s.count} ${s.severity}`}
        </Badge>
      ))}
    </Box>
  );
}
