import { Box, Text } from "ink";
import type { ReviewIssue, ReviewSeverity } from "@repo/schemas/review";
import { useTheme, type ThemeColors } from "../../../hooks/use-theme.js";

function getSeverityColor(colors: ThemeColors, severity: ReviewSeverity): string {
  switch (severity) {
    case "critical":
      return colors.severity.blocker;
    case "warning":
      return colors.severity.medium;
    case "suggestion":
      return colors.severity.low;
    case "nitpick":
      return colors.severity.nit;
  }
}

export function IssueItem({ issue }: { issue: ReviewIssue }) {
  const { colors } = useTheme();
  const severityColor = getSeverityColor(colors, issue.severity);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={severityColor} bold>
        [{issue.severity}] {issue.title}
      </Text>
      {issue.file && (
        <Text color={colors.ui.textMuted}>
          {"  "}File: {issue.file}
          {issue.line ? `:${issue.line}` : ""}
        </Text>
      )}
      <Text>{"  "}{issue.description}</Text>
      {issue.suggestion && (
        <Text color={colors.ui.success}>{"  "}Fix: {issue.suggestion}</Text>
      )}
    </Box>
  );
}
