import { getModelTierBadge } from "@diffgazer/core/providers";
import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";
import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { Box, Text } from "ink";
import { Badge } from "../../../components/ui/badge";
import { getModelDetail } from "../../../lib/model-detail";
import { terminalCellWidth } from "../../../lib/terminal-width";
import { rowTone, selectionHue } from "../../../theme/chrome";
import { useTheme } from "../../../theme/provider";

interface ModelListItemProps {
  model: ModelInfo;
  isHighlighted: boolean;
  isSelected: boolean;
  maxWidth: number;
}

function getPrefix(isSelected: boolean, isHighlighted: boolean): string {
  if (isSelected) return "| ";
  if (isHighlighted) return "> ";
  return "  ";
}

function badgeColumnWidth(label: string | undefined): number {
  return label ? terminalCellWidth(label) + 3 : 0;
}

export function ModelListItem({ model, isHighlighted, isSelected, maxWidth }: ModelListItemProps) {
  const { tokens } = useTheme();

  const prefix = getPrefix(isSelected, isHighlighted);
  const check = isSelected ? "[*]" : "[ ]";
  const tierBadge = getModelTierBadge(model.tier);
  const badgeWidth = badgeColumnWidth(tierBadge?.label);
  const textWidth = Math.max(1, maxWidth - 6 - badgeWidth);
  const detail = getModelDetail(model);
  const hasDetail = detail.length > 0 && textWidth >= 4;
  const detailWidth = hasDetail
    ? Math.min(Math.max(1, Math.floor(textWidth / 2)), textWidth - 2)
    : 0;
  const nameWidth = hasDetail ? textWidth - detailWidth - 1 : textWidth;

  const tone = rowTone(tokens, { isHighlighted });
  const markerColor = isSelected && !isHighlighted ? selectionHue(tokens) : tone.primary;
  const safeName = sanitizeTerminalText(model.name);
  const safeDetail = sanitizeTerminalText(detail);

  return (
    <Box width={maxWidth} backgroundColor={tone.background}>
      <Text color={markerColor} bold={isHighlighted || isSelected}>
        {prefix}
      </Text>
      <Text color={markerColor} bold>
        {check}{" "}
      </Text>
      <Box gap={1} flexShrink={0}>
        <Box width={nameWidth} flexShrink={0}>
          <Text color={tone.primary} bold wrap="truncate-end">
            {safeName}
          </Text>
        </Box>
        {tierBadge && (
          // The terminal palette reserves the success hue for readiness, so a
          // free model reads in the info hue here rather than the web's green.
          <Badge
            variant={tierBadge.variant === "success" ? "info" : tierBadge.variant}
            color={tone.background ? tone.primary : undefined}
          >
            {tierBadge.label}
          </Badge>
        )}
        {hasDetail && (
          <Box width={detailWidth} flexShrink={0}>
            <Text color={tone.secondary} wrap="truncate-end">
              {safeDetail}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
