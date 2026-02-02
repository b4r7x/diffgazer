import { Box, Text } from "ink";
import Spinner from "ink-spinner";

export function LoadingView() {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        Stargazer
      </Text>
      <Box marginTop={1}>
        <Spinner type="dots" />
        <Text> Checking configuration...</Text>
      </Box>
    </Box>
  );
}
