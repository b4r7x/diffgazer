import { Box, Text } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { formatTime } from "@diffgazer/core/format";

export interface ReviewMetricsFooterProps {
  filesProcessed: number;
  issuesFound: number;
  elapsed: number;
  isStreaming: boolean;
}

export function ReviewMetricsFooter({
  filesProcessed,
  issuesFound,
  elapsed,
  isStreaming,
}: ReviewMetricsFooterProps) {
  const { tokens } = useTheme();

  return (
    <Box borderStyle="single" borderColor={tokens.border} paddingX={1}>
      <Text color={tokens.muted}>Files: </Text>
      <Text color={tokens.fg}>{filesProcessed}</Text>
      <Text color={tokens.muted}> | Issues: </Text>
      <Text color={issuesFound > 0 ? tokens.warning : tokens.fg}>
        {issuesFound}
      </Text>
      <Text color={tokens.muted}> | Time: </Text>
      <Text color={tokens.info}>{formatTime(elapsed)}</Text>
      {isStreaming ? <Text color={tokens.muted}> ...</Text> : null}
    </Box>
  );
}
