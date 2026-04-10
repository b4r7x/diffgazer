import { Box, Text, useInput } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { TIER_FILTERS, type TierFilter } from "./model-select-helpers.js";

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
      const nextIdx = (currentIdx + direction + TIER_FILTERS.length) % TIER_FILTERS.length;
      const next = TIER_FILTERS[nextIdx];
      if (next) onValueChange(next);
    },
    { isActive },
  );

  return (
    <Box gap={1}>
      {TIER_FILTERS.map((filter) => {
        const isSelected = value === filter;
        return (
          <Text
            key={filter}
            color={isSelected ? tokens.fg : tokens.muted}
            backgroundColor={isSelected ? tokens.accent : undefined}
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
