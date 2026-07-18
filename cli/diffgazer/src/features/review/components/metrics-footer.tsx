import { formatTime } from "@diffgazer/core/format";
import { Box, Text } from "ink";
import { useTheme } from "../../../theme/provider";

export interface ReviewMetricsFooterProps {
  filesIncluded: number;
  issuesFound: number;
  elapsed: number;
}

export function ReviewMetricsFooter({
  filesIncluded,
  issuesFound,
  elapsed,
}: ReviewMetricsFooterProps) {
  const { tokens } = useTheme();

  return (
    <Box borderStyle="single" borderColor={tokens.border} paddingX={1}>
      <Text color={tokens.muted}>Prompt: </Text>
      <Text color={tokens.fg}>{filesIncluded}</Text>
      <Text color={tokens.muted}> | Issues: </Text>
      <Text color={issuesFound > 0 ? tokens.warning : tokens.fg}>{issuesFound}</Text>
      <Text color={tokens.muted}> | Time: </Text>
      <Text color={tokens.info}>{formatTime(elapsed)}</Text>
    </Box>
  );
}
