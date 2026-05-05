import { Box, Text } from "ink";
import { useTheme } from "../../theme/theme-context.js";

/** @see diffgazer/apps/web/src/components/layout/header.tsx ProviderDisplayStatus (identical web variant) */
export type ProviderDisplayStatus = "active" | "idle";

export interface HeaderProps {
  providerName: string;
  providerStatus: ProviderDisplayStatus;
  onBack?: () => void;
}

export function Header({ providerName, providerStatus, onBack }: HeaderProps) {
  const { tokens } = useTheme();

  const statusColor = providerStatus === "active" ? tokens.green : tokens.muted;
  const statusLabel = providerStatus === "active" ? "active" : "idle";

  return (
    <Box flexDirection="row" justifyContent="space-between" width="100%">
      <Box>
        {onBack ? (
          <Text color={tokens.muted}>[{"<"}] </Text>
        ) : null}
        <Text color={statusColor}>●</Text>
        <Text color={tokens.fg}> {providerName}</Text>
        <Text color={tokens.muted}> · {statusLabel}</Text>
      </Box>
      <Box>
        <Text color={tokens.border}>┃ </Text>
        <Text color={tokens.accent} bold>diffgazer</Text>
      </Box>
    </Box>
  );
}
