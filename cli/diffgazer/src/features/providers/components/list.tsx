import {
  getCatalogModelName,
  getProviderDisplayStatus,
  getProviderRowId,
  type ProviderListRow,
  UNRECOGNIZED_CONFIGURATION_COPY,
} from "@diffgazer/core/providers";
import {
  type ConfigurationId,
  canSelectConfiguration,
  type UnrecognizedConfiguration,
} from "@diffgazer/core/schemas/config";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { NavigationList } from "../../../components/ui/navigation-list";
import { terminalCellWidth } from "../../../lib/terminal-width";
import type { CliColorTokens } from "../../../theme/palettes";
import { useTheme } from "../../../theme/provider";
import { formatModelLabel } from "../lib/model-label";

interface ProviderListProps {
  providers: ProviderListRow[];
  /** Stored records this build could not decode; they trail the provider rows. */
  unrecognized: readonly UnrecognizedConfiguration[];
  selectedId?: string;
  highlightedId?: string;
  selectedConfigurationId?: ConfigurationId | null;
  onSelect?: (id: string) => void;
  onHighlightChange?: (id: string) => void;
  isActive?: boolean;
  contentWidth: number;
}

const PROVIDER_LIST_ROW_CHROME = 4;

function fitsListRow(name: string, subtitle: string, contentWidth: number): boolean {
  return (
    terminalCellWidth(name) + terminalCellWidth(subtitle) + PROVIDER_LIST_ROW_CHROME <= contentWidth
  );
}

/**
 * A subtitle rides along only when the whole row fits: truncating it would
 * trade legible words for an ellipsis, and the details pane always carries the
 * full text.
 */
function canShowListSubtitle(
  name: string,
  subtitle: string | undefined,
  contentWidth: number,
): subtitle is string {
  if (!subtitle) return false;
  return fitsListRow(name, subtitle, contentWidth);
}

/**
 * The catalog display name leads and the exact id trails it, as in the web
 * provider row. This pane is capped near 44 columns, so the id rides along only
 * when the whole row fits: truncating the pair would eat the name, which is the
 * half a reader can act on. The details pane always carries both.
 */
function getModelSubtitle(row: ProviderListRow, contentWidth: number): string | undefined {
  const modelId = row.configuration?.selectedModelId;
  if (modelId) {
    const label = formatModelLabel(row.product.productId, modelId);
    if (fitsListRow(row.product.name, label, contentWidth)) return label;
    return getCatalogModelName(row.product.productId, modelId);
  }
  return row.readiness.remediation.message;
}

function getStatusGlyph(
  row: ProviderListRow,
  selectedConfigurationId: ConfigurationId | null | undefined,
): string {
  if (canSelectConfiguration(row.readiness.status)) {
    return row.configuration?.configurationId === selectedConfigurationId ? "●" : "○";
  }
  return "!";
}

function getStatusColor(
  row: ProviderListRow,
  tokens: CliColorTokens,
  selectedConfigurationId: ConfigurationId | null | undefined,
): string {
  if (canSelectConfiguration(row.readiness.status)) {
    return row.configuration?.configurationId === selectedConfigurationId
      ? tokens.success
      : tokens.muted;
  }
  const badge = getProviderDisplayStatus(row.readiness);
  if (badge.variant === "error") return tokens.error;
  if (badge.variant === "warning") return tokens.warning;
  return tokens.muted;
}

export function ProviderList({
  providers,
  unrecognized,
  selectedId,
  highlightedId,
  selectedConfigurationId,
  onSelect,
  onHighlightChange,
  isActive = true,
  contentWidth,
}: ProviderListProps): ReactElement {
  const { tokens } = useTheme();

  return (
    <NavigationList
      selectedId={selectedId}
      highlightedId={highlightedId}
      onSelect={onSelect}
      onHighlightChange={onHighlightChange}
      isActive={isActive}
    >
      {providers.map((row) => {
        const rowId = getProviderRowId(row);
        const subtitle = getModelSubtitle(row, contentWidth);
        const showSubtitle = canShowListSubtitle(row.product.name, subtitle, contentWidth);

        return (
          <NavigationList.Item key={rowId} id={rowId}>
            {({ tone }) => (
              <Box gap={1} width={contentWidth} flexWrap="nowrap" overflow="hidden">
                <Box flexShrink={0}>
                  <Text
                    color={
                      tone.background
                        ? tone.primary
                        : getStatusColor(row, tokens, selectedConfigurationId)
                    }
                  >
                    {getStatusGlyph(row, selectedConfigurationId)}
                  </Text>
                </Box>
                <Box flexShrink={0} overflow="hidden">
                  <Text color={tone.primary} bold wrap="truncate-end">
                    {row.product.name}
                  </Text>
                </Box>
                {showSubtitle ? (
                  <Box flexShrink={1} overflow="hidden">
                    {/* Truncates from the end because the subtitle now leads with
                        the display name; cutting the head would hide it. */}
                    <Text color={tone.secondary} wrap="truncate-end">
                      {subtitle}
                    </Text>
                  </Box>
                ) : null}
              </Box>
            )}
          </NavigationList.Item>
        );
      })}
      {/* No product, model, or readiness to show — the id is what ties the row to
          the record on disk, and the details pane explains it. */}
      {unrecognized.map(({ configurationId }) => (
        <NavigationList.Item key={configurationId} id={configurationId}>
          {({ tone }) => (
            <Box gap={1} width={contentWidth} flexWrap="nowrap" overflow="hidden">
              <Box flexShrink={0}>
                <Text color={tone.background ? tone.primary : tokens.warning}>!</Text>
              </Box>
              <Box flexShrink={0} overflow="hidden">
                <Text color={tone.primary} bold wrap="truncate-end">
                  {UNRECOGNIZED_CONFIGURATION_COPY.label}
                </Text>
              </Box>
              {canShowListSubtitle(
                UNRECOGNIZED_CONFIGURATION_COPY.label,
                configurationId,
                contentWidth,
              ) ? (
                <Box flexShrink={1} overflow="hidden">
                  <Text color={tone.secondary} wrap="truncate-end">
                    {configurationId}
                  </Text>
                </Box>
              ) : null}
            </Box>
          )}
        </NavigationList.Item>
      ))}
    </NavigationList>
  );
}
