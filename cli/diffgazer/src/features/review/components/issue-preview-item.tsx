import { sanitizeTerminalText } from "@diffgazer/core/review";
import { SEVERITY_LABELS } from "@diffgazer/core/schemas/presentation";
import type { ReviewSeverity } from "@diffgazer/core/schemas/review";
import { Box, Text } from "ink";
import { Badge } from "../../../components/ui/badge";
import { useTheme } from "../../../theme/provider";
import { severityColor } from "../../../theme/severity";

export interface IssuePreviewItemProps {
  severity: ReviewSeverity;
  filePath: string;
  title: string;
  contentWidth: number;
  isHighlighted?: boolean;
}

const BADGE_FRAME_COLUMNS = 2;
const ITEM_GAP_COLUMNS = 2;
const MIN_PATH_COLUMNS = 8;

function toSingleLine(value: string): string {
  return sanitizeTerminalText(value).replace(/\s+/g, " ").trim();
}

function getTextColumnBudget(severityLabel: string, contentWidth: number) {
  const textColumns = Math.max(
    contentWidth - severityLabel.length - BADGE_FRAME_COLUMNS - ITEM_GAP_COLUMNS,
    2,
  );
  const pathColumns = Math.min(
    Math.max(Math.floor(textColumns * 0.4), MIN_PATH_COLUMNS),
    textColumns - 1,
  );
  return { pathColumns, titleColumns: textColumns - pathColumns };
}

export function IssuePreviewItem({
  severity,
  filePath,
  title,
  contentWidth,
  isHighlighted = false,
}: IssuePreviewItemProps) {
  const { tokens } = useTheme();
  const label = SEVERITY_LABELS[severity];
  const color = severityColor(severity, tokens);
  const pathDisplay = toSingleLine(filePath);
  const titleDisplay = toSingleLine(title);
  const { pathColumns, titleColumns } = getTextColumnBudget(label, contentWidth);

  return (
    <Box gap={1} width={contentWidth} height={1} overflow="hidden" flexWrap="nowrap">
      <Box flexShrink={0}>
        <Badge color={color}>{label}</Badge>
      </Box>
      <Box width={pathColumns} flexShrink={0}>
        <Text
          color={isHighlighted ? tokens.bg : tokens.muted}
          backgroundColor={isHighlighted ? tokens.fg : undefined}
          wrap="truncate-start"
        >
          {pathDisplay}
        </Text>
      </Box>
      <Box width={titleColumns} flexShrink={0}>
        <Text
          color={isHighlighted ? tokens.bg : undefined}
          backgroundColor={isHighlighted ? tokens.fg : undefined}
          bold={isHighlighted}
          wrap="truncate-end"
        >
          {titleDisplay}
        </Text>
      </Box>
    </Box>
  );
}
