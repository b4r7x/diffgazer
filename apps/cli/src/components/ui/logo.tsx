import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { getFigletText } from "@diffgazer/hooks";
import { useTheme } from "../../theme/theme-context.js";

interface LogoProps {
  color?: string;
}

export function Logo({ color }: LogoProps): ReactElement {
  const { tokens } = useTheme();
  const logoColor = color ?? tokens.accent;
  const text = getFigletText("Diffgazer", "Big");

  if (!text) {
    return <Text color={logoColor}>Diffgazer</Text>;
  }

  const lines = text.split("\n").filter((line) => line.trim());

  return (
    <Box flexDirection="column">
      {lines.map((line, i) => (
        <Text key={i} color={logoColor}>{line}</Text>
      ))}
    </Box>
  );
}
