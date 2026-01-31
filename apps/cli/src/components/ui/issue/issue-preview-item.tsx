import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { TriageSeverity } from "@repo/schemas/triage";
import { SEVERITY_ICONS } from "@repo/schemas/ui";
import { useTheme } from "../../../hooks/use-theme.js";
import { SeverityBadge } from "../badge.js";

export interface IssuePreviewItemProps {
  title: string;
  file: string;
  line: number;
  category: string;
  severity: TriageSeverity;
  isSelected?: boolean;
}

export function IssuePreviewItem({
  title,
  file,
  line,
  category,
  severity,
  isSelected = false,
}: IssuePreviewItemProps): ReactElement {
  const { colors } = useTheme();

  const icon = SEVERITY_ICONS[severity];
  const severityColor = colors.severity[severity];

  return (
    <Box paddingX={1} paddingY={0}>
      <Box width={3}>
        <Text color={isSelected ? colors.ui.accent : colors.ui.textMuted}>
          {isSelected ? "> " : "  "}
        </Text>
      </Box>
      <Box width={3}>
        <Text color={severityColor} bold>
          {icon}
        </Text>
      </Box>
      <Box flexDirection="column" flexGrow={1}>
        <Text color={isSelected ? colors.ui.accent : colors.ui.text} bold={isSelected}>
          {title}
        </Text>
        <Text color={colors.ui.textMuted} dimColor>
          {file}:{line}
        </Text>
      </Box>
      <Box marginLeft={2} gap={1}>
        <Text color={colors.ui.textMuted} dimColor>
          {category}
        </Text>
        <SeverityBadge severity={severity} />
      </Box>
    </Box>
  );
}
