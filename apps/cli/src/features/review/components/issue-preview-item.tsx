import { Box, Text } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { Badge } from "../../../components/ui/badge.js";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions.js";
import { severityVariant } from "../utils/severity-variant.js";

export interface IssuePreviewItemProps {
  severity: string;
  filePath: string;
  title: string;
  isHighlighted?: boolean;
}

function truncatePath(filePath: string, maxLength: number): string {
  if (filePath.length <= maxLength) return filePath;
  return "\u2026" + filePath.slice(-(maxLength - 1));
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
