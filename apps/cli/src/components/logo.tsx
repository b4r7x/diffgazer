import React from "react";
import { Box, Text } from "ink";
import { useFiglet } from "@stargazer/hooks";

interface LogoProps {
  color?: string;
}

export function Logo({ color = "cyan" }: LogoProps): React.ReactElement {
  const { text, isLoading } = useFiglet("Stargazer", "Big");

  if (isLoading || !text) {
    return <Text color={color}>Stargazer</Text>;
  }

  const lines = text.split("\n").filter((line) => line.trim());

  return (
    <Box flexDirection="column">
      {lines.map((line, i) => (
        <Text key={i} color={color}>{line}</Text>
      ))}
    </Box>
  );
}
