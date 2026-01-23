import type { ReactElement } from "react";
import { Box, Text } from "ink";

export function MainMenuView(): ReactElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>
        [g] Git Status [d] Git Diff [r] AI Review [h] Reviews [H] Sessions [S] Settings
        [q] Quit
      </Text>
    </Box>
  );
}
