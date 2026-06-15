import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { truncate } from "@diffgazer/core/strings";
import { Box, Text } from "ink";
import { Badge } from "../../../components/ui/badge";
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

  // Reserve space for prefix(2) + check(3) + gaps(3) + badge(~6) = ~14 chars
  const descMaxLen = Math.max(0, maxWidth - model.name.length - 18);
  const desc = model.description ? truncate(model.description, descMaxLen, "\u2026") : undefined;

  return (
    <Box>
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
      <Box gap={1} flexShrink={1}>
        <Text bold>{model.name}</Text>
        <Badge variant={model.tier === "free" ? "info" : "neutral"}>{model.tier}</Badge>
        {desc && <Text dimColor>{desc}</Text>}
      </Box>
    </Box>
  );
}
