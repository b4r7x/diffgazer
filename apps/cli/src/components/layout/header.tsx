import { Box, Text } from "ink";
import { useTheme } from "../../theme/theme-context.js";

export interface HeaderProps {
  providerName: string;
  providerStatus: "active" | "idle";
  onBack?: () => void;
}

export function Header({ providerName, providerStatus, onBack }: HeaderProps) {
  const { tokens } = useTheme();

  const statusColor = providerStatus === "active" ? tokens.green : tokens.muted;

  return (
    <Box flexDirection="row" justifyContent="space-between" width="100%">
      <Box>
        {onBack ? (
          <Text color={tokens.muted}>[{"<"}] </Text>
        ) : null}
        <Text color={tokens.fg}>{providerName}</Text>
        <Text color={statusColor}> ●</Text>
      </Box>
      <Box>
        <Text color={tokens.border}>┃ </Text>
        <Text color={tokens.accent} bold>diffgazer</Text>
      </Box>
    </Box>
  );
}
