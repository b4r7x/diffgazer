import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../../hooks/use-theme.js";
import type { TimelineItem } from "../types.js";

export interface TimelineListProps {
  items: TimelineItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isFocused?: boolean;
}

export function TimelineList({
  items,
  selectedId,
  onSelect,
  isFocused = true,
}: TimelineListProps): ReactElement {
  const { colors } = useTheme();

  return (
    <Box flexDirection="column">
      {items.map((item) => {
        const isSelected = item.id === selectedId;
        const showHighlight = isSelected && isFocused;

        return (
          <Box key={item.id} paddingX={1}>
            {/* Selection indicator */}
            <Text color={showHighlight ? colors.ui.info : colors.ui.textMuted}>
              {isSelected ? "●" : "○"}
            </Text>
            <Text> </Text>

            {/* Label */}
            <Box flexGrow={1}>
              <Text
                color={showHighlight ? colors.ui.info : colors.ui.text}
                bold={showHighlight}
              >
                {item.label}
              </Text>
            </Box>

            {/* Count badge */}
            <Text color={showHighlight ? colors.ui.info : colors.ui.textMuted}>
              {item.count}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
