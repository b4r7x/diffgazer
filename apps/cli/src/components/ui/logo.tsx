import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { getFigletText } from "@diffgazer/hooks";

interface LogoProps {
  color?: string;
}

export function Logo({ color = "cyan" }: LogoProps): ReactElement {
  const text = getFigletText("Diffgazer", "Big");

  if (!text) {
    return <Text color={color}>Diffgazer</Text>;
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
