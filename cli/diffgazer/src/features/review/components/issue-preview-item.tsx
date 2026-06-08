import type { ReviewSeverity } from "@diffgazer/core/schemas/review";
import { Box, Text } from "ink";
import { Badge } from "../../../components/ui/badge";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions";
import { useTheme } from "../../../theme/provider";
import { severityVariant } from "../../../theme/severity-variant";

export interface IssuePreviewItemProps {
  severity: ReviewSeverity;
  filePath: string;
  title: string;
  isHighlighted?: boolean;
}

function truncatePath(filePath: string, maxLength: number): string {
  if (filePath.length <= maxLength) return filePath;
  return `\u2026${filePath.slice(-(maxLength - 1))}`;
}

export function IssuePreviewItem({
  severity,
  filePath,
  title,
  isHighlighted = false,
}: IssuePreviewItemProps) {
  const { tokens } = useTheme();
  const { columns } = useTerminalDimensions();
  const maxPathLength = Math.max(15, Math.floor(columns * 0.3));

  const variant = severityVariant(severity);
  const pathDisplay = truncatePath(filePath, maxPathLength);

  if (isHighlighted) {
    return (
      <Box gap={1}>
        <Badge variant={variant}>{severity}</Badge>
        <Text backgroundColor={tokens.fg} color={tokens.bg}>
          {pathDisplay}
        </Text>
        <Text backgroundColor={tokens.fg} color={tokens.bg} bold>
          {title}
        </Text>
      </Box>
    );
  }

  return (
    <Box gap={1}>
      <Badge variant={variant}>{severity}</Badge>
      <Text color={tokens.muted}>{pathDisplay}</Text>
      <Text>{title}</Text>
    </Box>
  );
}
