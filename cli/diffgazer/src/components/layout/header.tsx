import { isRedundantStatusSegment, type ProviderDisplayStatus } from "@diffgazer/core/providers";
import { Box, Text } from "ink";
import { useResponsive } from "../../hooks/use-terminal-dimensions";
import { terminalCellWidth } from "../../lib/terminal-width";
import { useTheme } from "../../theme/provider";

export interface HeaderProps {
  providerName: string;
  providerStatus: ProviderDisplayStatus;
  showBack: boolean;
}

export const WORDMARK = "diffgazer";
/** The ornament row under the wordmark, shared with the pre-app gate screens. */
export const WORDMARK_RULE = "- * - + -";
const PROVIDER_MODEL_SEPARATOR = " / ";
/** Blank columns held between the centred wordmark and the status slot. */
const WORDMARK_GAP = 2;
/** The status dot and the space after it, drawn before the provider label. */
const STATUS_MARKER_COLUMNS = 2;

/**
 * The status slot only gets what the centred wordmark leaves over. When the
 * full "provider / model" label does not fit, drop the provider prefix instead
 * of eliding the model: the provider is implied by the model name, while a
 * middle-elided "ge...ash" identifies nothing.
 */
export function fitProviderLabel(display: string, availableColumns: number): string {
  if (terminalCellWidth(display) <= availableColumns) return display;
  const separatorIndex = display.indexOf(PROVIDER_MODEL_SEPARATOR);
  if (separatorIndex === -1) return display;
  return display.slice(separatorIndex + PROVIDER_MODEL_SEPARATOR.length);
}

export function Header({ providerName, providerStatus, showBack }: HeaderProps) {
  const { tokens } = useTheme();
  const { columns, isNarrow } = useResponsive();

  const statusColor = providerStatus.variant === "success" ? tokens.success : tokens.muted;
  const sideWidth = Math.max(Math.floor((columns - 2 - terminalCellWidth(WORDMARK)) / 2), 10);
  const statusSuffix =
    isNarrow || isRedundantStatusSegment(providerName, providerStatus.label)
      ? ""
      : ` · ${providerStatus.label}`;
  const statusColumns = sideWidth - WORDMARK_GAP;
  const label = fitProviderLabel(
    providerName,
    statusColumns - STATUS_MARKER_COLUMNS - terminalCellWidth(statusSuffix),
  );

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
            {WORDMARK}
          </Text>
        </Box>
        <Box
          width={sideWidth}
          height={1}
          paddingLeft={WORDMARK_GAP}
          justifyContent="flex-end"
          overflow="hidden"
        >
          <Text wrap="truncate-middle">
            <Text color={statusColor}>*</Text>
            <Text color={tokens.fg}>{` ${label}`}</Text>
            {statusSuffix ? <Text color={tokens.muted}>{statusSuffix}</Text> : null}
          </Text>
        </Box>
      </Box>
      <Box justifyContent="center">
        <Text color={tokens.muted}>{WORDMARK_RULE}</Text>
      </Box>
    </Box>
  );
}
