import { Box, Text } from "ink";
import { useTheme } from "../../theme/provider";

/** @see diffgazer/apps/web/src/components/layout/header.tsx ProviderDisplayStatus (identical web variant) */
export type ProviderDisplayStatus = "active" | "idle";

export interface HeaderProps {
  providerName: string;
  providerStatus: ProviderDisplayStatus;
  onBack?: () => void;
}

export function Header({ providerName, providerStatus, onBack }: HeaderProps) {
  const { tokens } = useTheme();

  const statusColor = providerStatus === "active" ? tokens.success : tokens.muted;
  const statusLabel = providerStatus === "active" ? "active" : "idle";

  return (
    <Box flexDirection="column" paddingX={1} paddingTop={1} paddingBottom={0}>
      <Box flexDirection="row" justifyContent="space-between" width="100%">
        <Box minWidth={10}>{onBack ? <Text color={tokens.muted}>{"← Back"}</Text> : null}</Box>
        <Box>
          <Text color={tokens.accent} bold>
            diffgazer
          </Text>
        </Box>
        <Box minWidth={10} justifyContent="flex-end">
          <Text color={statusColor}>●</Text>
          <Text color={tokens.fg}> {providerName} </Text>
          <Text color={tokens.muted}>· {statusLabel}</Text>
        </Box>
      </Box>
      <Box justifyContent="center">
        <Text color={tokens.muted}>─ ✦ ─ ✧ ─</Text>
      </Box>
    </Box>
  );
}
