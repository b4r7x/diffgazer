import { Box, Text } from "ink";

export function MainMenuView() {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>
        [g] Git Status [d] Git Diff [r] AI Review [h] Reviews [H] Sessions [S] Settings
        [q] Quit
      </Text>
    </Box>
  );
}
