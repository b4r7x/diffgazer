import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { formatRelativeTime } from "@repo/core";
import { useTheme } from "../../hooks/use-theme.js";
import { Card } from "./card.js";

interface StatusCardProps {
  provider: string;
  model?: string;
  isTrusted: boolean;
  lastReviewAt?: string | null;
}

export function StatusCard({
  provider,
  model,
  isTrusted,
  lastReviewAt,
}: StatusCardProps): ReactElement {
  const { colors } = useTheme();

  const providerDisplay = model ? `${provider} (${model})` : provider;
  const trustDisplay = isTrusted ? "This directory" : "Not trusted";
  const trustIcon = isTrusted ? "\u2713" : "\u2717";
  const trustColor = isTrusted ? colors.ui.success : colors.ui.warning;

  const lastReviewDisplay = lastReviewAt
    ? formatRelativeTime(lastReviewAt)
    : "Never";

  return (
    <Card title="Status">
      <Box flexDirection="column" gap={0}>
        <Box>
          <Text dimColor>Provider: </Text>
          <Text color={colors.ui.accent}>{providerDisplay}</Text>
        </Box>
        <Box>
          <Text dimColor>Trust: </Text>
          <Text color={trustColor}>
            {trustIcon} {trustDisplay}
          </Text>
        </Box>
        <Box>
          <Text dimColor>Last review: </Text>
          <Text>{lastReviewDisplay}</Text>
        </Box>
      </Box>
    </Card>
  );
}
