import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { TriageSeverity } from "@repo/schemas/triage";
import { useTheme } from "../../../hooks/use-theme.js";
import { SeverityBadge } from "../badge.js";

export interface IssueHeaderProps {
  title: string;
  severity: TriageSeverity;
  file: string;
  line: number;
}

export function IssueHeader({ title, severity, file, line }: IssueHeaderProps): ReactElement {
  const { colors } = useTheme();

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box gap={1} marginBottom={1}>
        <SeverityBadge severity={severity} />
        <Text color={colors.severity[severity]} bold>
          {title}
        </Text>
      </Box>
      <Box>
        <Text color={colors.ui.textMuted}>Location: </Text>
        <Text color={colors.ui.text}>
          {file}:{line}
        </Text>
      </Box>
    </Box>
  );
}
