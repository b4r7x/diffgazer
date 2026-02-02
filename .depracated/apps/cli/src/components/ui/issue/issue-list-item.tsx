import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { TriageSeverity } from "@repo/schemas/triage";
import type { TriageIssue } from "@repo/schemas";
import { SEVERITY_ICONS } from "@repo/schemas/ui";
import { useTheme } from "../../../hooks/use-theme.js";

export interface IssueListItemProps {
  issue: TriageIssue;
  isSelected: boolean;
}

export function IssueListItem({ issue, isSelected }: IssueListItemProps): ReactElement {
  const { colors } = useTheme();

  const severity = issue.severity as TriageSeverity;
  const icon = SEVERITY_ICONS[severity] ?? "-";
  const severityColor = colors.severity[severity];

  return (
    <Box>
      <Text color={isSelected ? colors.ui.accent : colors.ui.textMuted}>
        {isSelected ? ">" : " "}
      </Text>
      <Text> </Text>
      <Text color={isSelected ? colors.ui.text : severityColor}>{icon}</Text>
      <Text> </Text>
      <Box flexDirection="column" flexGrow={1}>
        <Text
          color={colors.ui.text}
          bold={isSelected}
          inverse={isSelected}
        >
          {" "}{issue.title}{" "}
        </Text>
        <Text color={colors.ui.textMuted} dimColor>
          {"  "}{issue.file}:{issue.line_start ?? 0}
        </Text>
      </Box>
    </Box>
  );
}
