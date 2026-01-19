import React from "react";
import { Box, Text } from "ink";

export interface AppProps {
  address: string;
  isRunning: boolean;
}

export function App({ address, isRunning }: AppProps): React.ReactElement {
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Stargazer
        </Text>
      </Box>

      <Box flexDirection="column">
        <Text>
          Server:{" "}
          <Text color="blue">{address}</Text>
        </Text>
        <Text color={isRunning ? "green" : "red"}>
          {isRunning ? "Running" : "Stopped"}
        </Text>
        {isRunning && (
          <Box marginTop={1}>
            <Text dimColor>Press Ctrl+C to stop</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
