import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { Badge } from "../../../components/ui/badge.js";
import { useTheme } from "../../../theme/theme-context.js";
import { severityVariant } from "../../../theme/severity-variant.js";
import type { ReviewSeverity } from "@diffgazer/core/schemas/review";

export interface RunItemProps {
  displayId: string;
  branch: string;
  timestamp: string;
  summary: string;
  issueCount: number;
  severities: Array<{ severity: ReviewSeverity; count: number }>;
  isHighlighted?: boolean;
}

export function RunItem({
  displayId,
  branch,
  timestamp,
  summary,
  issueCount,
  severities,
  isHighlighted = false,
}: RunItemProps): ReactElement {
  const { tokens } = useTheme();

  const visible = severities.filter((s) => s.count > 0);

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={1}>
        <Text bold color={isHighlighted ? tokens.accent : tokens.fg}>
          {displayId}
        </Text>
        <Badge variant="neutral">{branch}</Badge>
        <Box flexGrow={1} />
        <Text color={tokens.muted}>{timestamp}</Text>
      </Box>
      <Box flexDirection="row" gap={1}>
        <Text color={isHighlighted ? tokens.fg : tokens.muted}>
          {summary}
        </Text>
      </Box>
      {visible.length > 0 && (
        <Box flexDirection="row" gap={1}>
          {visible.map((s) => (
            <Badge key={s.severity} variant={severityVariant(s.severity)}>
              {`${s.count} ${s.severity}`}
            </Badge>
          ))}
        </Box>
      )}
    </Box>
  );
}
