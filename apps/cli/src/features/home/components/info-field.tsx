import type { ReactNode } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../../theme/theme-context.js";

interface InfoFieldProps {
  label: string;
  value: ReactNode;
}

export function InfoField({ label, value }: InfoFieldProps) {
  const { tokens } = useTheme();

  return (
    <Box gap={1}>
      <Text color={tokens.muted}>{label}</Text>
      {typeof value === "string" || typeof value === "number"
        ? <Text>{value}</Text>
        : value}
    </Box>
  );
}
