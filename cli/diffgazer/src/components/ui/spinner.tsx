import { Box, Text } from "ink";
import InkSpinner from "ink-spinner";
import { useTheme } from "../../theme/provider";

export interface SpinnerProps {
  label?: string;
  size?: "sm" | "md";
}

const gapBySize = {
  sm: 0,
  md: 1,
} as const;

export function Spinner({ label, size = "md" }: SpinnerProps) {
  const { tokens } = useTheme();

  return (
    <Box flexDirection="row" gap={gapBySize[size]}>
      <Text color={tokens.accent}>
        <InkSpinner type="dots" />
      </Text>
      {label != null ? <Text>{label}</Text> : null}
    </Box>
  );
}
