import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

interface KeyboardHintProps {
  keys: string | string[];
  description: string;
}

export function KeyboardHint({ keys, description }: KeyboardHintProps): ReactElement {
  const { colors } = useTheme();
  const keyList = Array.isArray(keys) ? keys : [keys];

  return (
    <Box gap={1}>
      {keyList.map((key, index) => (
        <Box key={key}>
          {index > 0 && <Text color={colors.ui.textMuted}>+</Text>}
          <Text color={colors.ui.accent} bold inverse>
            {` ${key} `}
          </Text>
        </Box>
      ))}
      <Text bold>{description}</Text>
    </Box>
  );
}
