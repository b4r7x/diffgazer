import { Box, Text } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { Badge } from "../../../components/ui/badge.js";

export interface IssuePreviewItemProps {
  severity: string;
  filePath: string;
  title: string;
  isHighlighted?: boolean;
}

const MAX_PATH_LENGTH = 30;

function severityVariant(
  severity: string,
): "error" | "warning" | "info" | "neutral" {
  switch (severity) {
    case "blocker":
    case "high":
      return "error";
    case "medium":
      return "warning";
    case "low":
      return "info";
    default:
      return "neutral";
  }
}

function truncatePath(filePath: string): string {
  if (filePath.length <= MAX_PATH_LENGTH) return filePath;
  return "\u2026" + filePath.slice(-(MAX_PATH_LENGTH - 1));
}

export function IssuePreviewItem({
  severity,
  filePath,
  title,
  isHighlighted = false,
}: IssuePreviewItemProps) {
  const { tokens } = useTheme();

  const variant = severityVariant(severity);
  const pathDisplay = truncatePath(filePath);

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
