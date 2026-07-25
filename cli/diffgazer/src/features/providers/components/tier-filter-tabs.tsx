import { TIER_FILTERS, type TierFilter } from "@diffgazer/core/providers";
import { clampIndex } from "@diffgazer/keys";
import { Box, Text, useInput } from "ink";
import { rowTone } from "../../../theme/chrome";
import { useTheme } from "../../../theme/provider";

interface TierFilterTabsProps {
  value: TierFilter;
  onValueChange: (value: TierFilter) => void;
  isActive: boolean;
}

export function TierFilterTabs({ value, onValueChange, isActive }: TierFilterTabsProps) {
  const { tokens } = useTheme();

  useInput(
    (_input, key) => {
      if (!key.leftArrow && !key.rightArrow) return;
      const currentIdx = TIER_FILTERS.indexOf(value);
      const direction = key.rightArrow ? 1 : -1;
      const next = TIER_FILTERS[clampIndex(currentIdx, direction, TIER_FILTERS.length, true)];
      if (next) onValueChange(next);
    },
    { isActive },
  );

  return (
    <Box gap={1}>
      {TIER_FILTERS.map((filter) => {
        const isSelected = value === filter;
        const tone = rowTone(tokens, { isHighlighted: isSelected });
        return (
          <Text
            key={filter}
            color={isSelected ? tone.primary : tone.secondary}
            backgroundColor={tone.background}
            bold={isSelected}
          >
            {` ${filter.toUpperCase()} `}
          </Text>
        );
      })}
      {isActive && <Text color={tokens.muted}> {"<-/->"}</Text>}
    </Box>
  );
}
