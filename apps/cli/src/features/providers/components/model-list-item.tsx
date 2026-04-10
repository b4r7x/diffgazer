import { Box, Text } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { Badge } from "../../../components/ui/badge.js";
import type { DisplayModel } from "./model-select-helpers.js";

interface ModelListItemProps {
  model: DisplayModel;
  isHighlighted: boolean;
  isSelected: boolean;
  maxWidth: number;
}

export function ModelListItem({ model, isHighlighted, isSelected, maxWidth }: ModelListItemProps) {
  const { tokens } = useTheme();

  const prefix = isSelected ? "| " : isHighlighted ? "> " : "  ";
  const check = isSelected ? "[*]" : "[ ]";

  // Reserve space for prefix(2) + check(3) + gaps(3) + badge(~6) = ~14 chars
  const descMaxLen = Math.max(0, maxWidth - model.name.length - 18);
  const desc = model.description
    ? model.description.length > descMaxLen
      ? model.description.slice(0, Math.max(0, descMaxLen - 1)) + "\u2026"
      : model.description
    : undefined;

  return (
    <Box>
      <Text
        color={isHighlighted ? tokens.fg : undefined}
        backgroundColor={isHighlighted ? tokens.accent : undefined}
        bold={isHighlighted || isSelected}
      >
        {prefix}
      </Text>
      <Text color={isSelected ? tokens.info : undefined} bold>{check} </Text>
      <Box gap={1} flexShrink={1}>
        <Text bold>{model.name}</Text>
        <Badge variant={model.tier === "free" ? "info" : "neutral"}>
          {model.tier}
        </Badge>
        {desc && <Text dimColor>{desc}</Text>}
      </Box>
    </Box>
  );
}
