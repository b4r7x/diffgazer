import { Box, Text } from "ink";
import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { useTheme } from "../../../theme/theme-context.js";
import { Badge } from "../../../components/ui/badge.js";

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

function truncateDescription(description: string | undefined, maxLen: number): string | undefined {
  if (!description) return undefined;
  if (description.length <= maxLen) return description;
  return description.slice(0, Math.max(0, maxLen - 1)) + "\u2026";
}

export function ModelListItem({ model, isHighlighted, isSelected, maxWidth }: ModelListItemProps) {
  const { tokens } = useTheme();

  const prefix = getPrefix(isSelected, isHighlighted);
  const check = isSelected ? "[*]" : "[ ]";

  // Reserve space for prefix(2) + check(3) + gaps(3) + badge(~6) = ~14 chars
  const descMaxLen = Math.max(0, maxWidth - model.name.length - 18);
  const desc = truncateDescription(model.description, descMaxLen);

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
