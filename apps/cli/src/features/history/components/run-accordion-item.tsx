import type { ReactElement, ReactNode } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../../hooks/use-theme.js";
import { Badge } from "../../../components/ui/badge.js";
import { IssueListItem } from "../../../components/ui/issue-list-item.js";
import type { TriageIssue } from "@repo/schemas";

export interface RunAccordionItemProps {
  id: string;
  displayId: string;
  branch: string;
  provider: string;
  timestamp: string;
  summary: ReactNode;
  issues: TriageIssue[];
  isSelected: boolean;
  isExpanded: boolean;
  criticalCount?: number;
  warningCount?: number;
}

export function RunAccordionItem({
  id,
  displayId,
  branch,
  provider,
  timestamp,
  summary,
  issues,
  isSelected,
  isExpanded,
  criticalCount = 0,
  warningCount = 0,
}: RunAccordionItemProps): ReactElement {
  const { colors } = useTheme();

  return (
    <Box flexDirection="column">
      {/* Header row - no borders, clean layout */}
      <Box
        flexDirection="column"
        paddingX={1}
        paddingY={0}
        marginBottom={isExpanded ? 0 : 0}
      >
        {/* First line: ID, branch, provider, timestamp */}
        <Box>
          {/* Selection indicator */}
          <Text color={isSelected ? colors.ui.info : colors.ui.textMuted}>
            {isSelected ? "▶" : " "}
          </Text>
          <Text> </Text>

          {/* Display ID */}
          <Text color={isSelected ? colors.ui.info : colors.ui.textMuted} bold={isSelected}>
            {displayId}
          </Text>
          <Text>  </Text>

          {/* Branch badge */}
          <Badge text={branch} variant={branch === "Staged" ? "success" : "muted"} />
          <Text>  </Text>

          {/* Provider */}
          <Text color={colors.ui.textMuted}>{provider}</Text>

          {/* Spacer */}
          <Box flexGrow={1} />

          {/* Timestamp */}
          <Text color={colors.ui.textMuted}>{timestamp}</Text>
        </Box>

        {/* Second line: Summary with severity counts */}
        <Box paddingLeft={2}>
          <Text color={isSelected ? colors.ui.text : colors.ui.textMuted}>
            {summary}
          </Text>
          {criticalCount > 0 && (
            <Text color={colors.severity.blocker}> {criticalCount}C</Text>
          )}
          {warningCount > 0 && (
            <Text color={colors.severity.high}> {warningCount}W</Text>
          )}
        </Box>

        {/* Third line: Actions (only when selected) */}
        {isSelected && (
          <Box paddingLeft={2} marginTop={0}>
            <Text color={colors.ui.textMuted}>
              <Text color={colors.ui.info}>[r]</Text> Resume
              {"  "}
              <Text color={colors.ui.info}>[e]</Text> Export
              {"  "}
              <Text color={colors.ui.info}>[Enter]</Text> {isExpanded ? "Collapse" : "Expand"}
            </Text>
          </Box>
        )}
      </Box>

      {/* Expanded issue list */}
      {isExpanded && issues.length > 0 && (
        <Box
          flexDirection="column"
          paddingLeft={4}
          marginLeft={1}
        >
          {issues.map((issue) => (
            <IssueListItem
              key={issue.id}
              issue={issue}
              isSelected={false}
            />
          ))}
        </Box>
      )}

    </Box>
  );
}
