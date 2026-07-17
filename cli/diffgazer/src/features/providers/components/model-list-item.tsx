import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { Box, Text } from "ink";
import { Badge } from "../../../components/ui/badge";
import { terminalCellWidth } from "../../../lib/terminal-width";
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

export function ModelListItem({ model, isHighlighted, isSelected, maxWidth }: ModelListItemProps) {
  const { tokens } = useTheme();

  const prefix = getPrefix(isSelected, isHighlighted);
  const check = isSelected ? "[*]" : "[ ]";
  const badgeWidth = terminalCellWidth(model.tier) + 2;
  const textWidth = Math.max(1, maxWidth - 6 - badgeWidth - 1);
  const hasDescription = Boolean(model.description) && textWidth >= 4;
  const descriptionWidth = hasDescription
    ? Math.min(Math.max(1, Math.floor(textWidth / 3)), textWidth - 2)
    : 0;
  const nameWidth = hasDescription ? textWidth - descriptionWidth - 1 : textWidth;

  return (
    <Box width={maxWidth}>
      <Text
        color={isHighlighted ? tokens.fg : undefined}
        backgroundColor={isHighlighted ? tokens.accent : undefined}
        bold={isHighlighted || isSelected}
      >
        {prefix}
      </Text>
      <Text color={isSelected ? tokens.info : undefined} bold>
        {check}{" "}
      </Text>
      <Box gap={1} flexShrink={0}>
        <Box width={nameWidth} flexShrink={0}>
          <Text bold wrap="truncate-end">
            {model.name}
          </Text>
        </Box>
        <Badge variant={model.tier === "free" ? "info" : "neutral"}>{model.tier}</Badge>
        {hasDescription && (
          <Box width={descriptionWidth} flexShrink={0}>
            <Text dimColor wrap="truncate-end">
              {model.description}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
