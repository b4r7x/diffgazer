import type { ProviderDisplayStatus } from "@diffgazer/core/providers";
import { Box, Text } from "ink";
import { useResponsive } from "../../hooks/use-terminal-dimensions";
import { useTheme } from "../../theme/provider";

export interface HeaderProps {
  providerName: string;
  providerStatus: ProviderDisplayStatus;
  showBack: boolean;
}

export function Header({ providerName, providerStatus, showBack }: HeaderProps) {
  const { tokens } = useTheme();
  const { columns, isNarrow } = useResponsive();

  const statusColor = providerStatus === "active" ? tokens.success : tokens.muted;
  const sideWidth = Math.max(Math.floor((columns - 2) / 3), 10);

  return (
    <Box flexDirection="column" paddingX={1} paddingTop={1} paddingBottom={0}>
      <Box
        flexDirection="row"
        justifyContent="space-between"
        width="100%"
        height={1}
        overflow="hidden"
      >
        <Box width={sideWidth}>
          {showBack ? <Text color={tokens.muted}>{"← Back"}</Text> : null}
        </Box>
        <Box>
          <Text color={tokens.accent} bold>
            diffgazer
          </Text>
        </Box>
        <Box width={sideWidth} height={1} justifyContent="flex-end" overflow="hidden">
          <Text wrap="truncate-middle">
            <Text color={statusColor}>*</Text>
            <Text color={tokens.fg}>{` ${providerName}`}</Text>
            {isNarrow ? null : <Text color={tokens.muted}> · {providerStatus}</Text>}
          </Text>
        </Box>
      </Box>
      <Box justifyContent="center">
        <Text color={tokens.muted}>- * - + -</Text>
      </Box>
    </Box>
  );
}
