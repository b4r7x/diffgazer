import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../hooks/use-theme.js";
import { SeverityBadge } from "./badge.js";

type SeverityLevel = "blocker" | "high" | "medium" | "low" | "nit";

export interface IssueHeaderProps {
  title: string;
  severity: SeverityLevel;
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
