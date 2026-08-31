import { type EndpointProfile, poolBadgeLabel } from "@diffgazer/core/providers";
import { clampIndex } from "@diffgazer/keys";
import { Box, Text, useInput } from "ink";
import { rowTone } from "../../../theme/chrome";
import { useTheme } from "../../../theme/provider";

interface PoolFilterTabsProps {
  /** The product's billing pools in rendered order, bound pool first. */
  profiles: readonly EndpointProfile[];
  /** The armed pool: the one a row both pools serve will bill. */
  value: string;
  onChange: (value: string) => void;
  isActive: boolean;
}

/**
 * Pool selector, not a pool filter: it never changes which rows the list shows,
 * only which pool a row that both pools serve will bill. Named for the tier row
 * it mirrors, which owns the segmented idiom this overlay already draws.
 */
export function PoolFilterTabs({ profiles, value, onChange, isActive }: PoolFilterTabsProps) {
  const { tokens } = useTheme();

  useInput(
    (_input, key) => {
      if (!key.leftArrow && !key.rightArrow) return;
      const currentIdx = profiles.findIndex((profile) => profile.id === value);
      const direction = key.rightArrow ? 1 : -1;
      const next = profiles[clampIndex(currentIdx, direction, profiles.length, true)];
      if (next) onChange(next.id);
    },
    { isActive },
  );

  return (
    <Box gap={1}>
      {profiles.map((profile) => {
        const isSelected = value === profile.id;
        const tone = rowTone(tokens, { isHighlighted: isSelected });
        return (
          <Text
            key={profile.id}
            color={isSelected ? tone.primary : tone.secondary}
            backgroundColor={tone.background}
            bold={isSelected}
          >
            {`${isSelected ? " · " : "  "}${poolBadgeLabel(profile)} `}
          </Text>
        );
      })}
      {isActive && <Text color={tokens.muted}> {"<-/->"}</Text>}
    </Box>
  );
}
