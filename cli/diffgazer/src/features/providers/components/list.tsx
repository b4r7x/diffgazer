import {
  getProviderDisplayStatus,
  getProviderRowId,
  type ProviderListRow,
} from "@diffgazer/core/providers";
import type { ConfigurationId } from "@diffgazer/core/schemas/config";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { NavigationList } from "../../../components/ui/navigation-list";
import type { CliColorTokens } from "../../../theme/palettes";
import { useTheme } from "../../../theme/provider";

interface ProviderListProps {
  providers: ProviderListRow[];
  selectedId?: string;
  highlightedId?: string;
  selectedConfigurationId?: ConfigurationId | null;
  onSelect?: (id: string) => void;
  onHighlightChange?: (id: string) => void;
  isActive?: boolean;
  contentWidth: number;
  compact?: boolean;
}

const PROVIDER_LIST_ROW_CHROME = 4;

function canShowListSubtitle(
  name: string,
  subtitle: string | undefined,
  contentWidth: number,
  compact: boolean,
): subtitle is string {
  if (!subtitle) return false;
  if (!compact) return true;
  return name.length + subtitle.length + PROVIDER_LIST_ROW_CHROME <= contentWidth;
}

function getModelSubtitle(row: ProviderListRow): string | undefined {
  if (row.configuration?.selectedModelId) return row.configuration.selectedModelId;
  if (row.product.status === "removed") return "Removed record";
  if (row.readiness.status === "unsupported" && row.product.transportFamily === "local-cli") {
    return "CLI unsupported";
  }
  return row.readiness.remediation.message;
}

function getStatusGlyph(
  row: ProviderListRow,
  selectedConfigurationId: ConfigurationId | null | undefined,
): string {
  if (row.product.status === "removed") return "×";
  if (row.readiness.ready) {
    return row.configuration?.configurationId === selectedConfigurationId ? "●" : "○";
  }
  return "!";
}

function getStatusColor(
  row: ProviderListRow,
  tokens: CliColorTokens,
  selectedConfigurationId: ConfigurationId | null | undefined,
): string {
  if (row.product.status === "removed") return tokens.error;
  if (row.readiness.ready) {
    return row.configuration?.configurationId === selectedConfigurationId
      ? tokens.success
      : tokens.muted;
  }
  const badge = getProviderDisplayStatus(row.readiness, row.product.transportFamily);
  if (badge.variant === "error") return tokens.error;
  if (badge.variant === "warning") return tokens.warning;
  return tokens.muted;
}

export function ProviderList({
  providers,
  selectedId,
  highlightedId,
  selectedConfigurationId,
  onSelect,
  onHighlightChange,
  isActive = true,
  contentWidth,
  compact = false,
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
        const isRemoved = row.product.status === "removed";
        const subtitle = getModelSubtitle(row);
        const showSubtitle = canShowListSubtitle(row.product.name, subtitle, contentWidth, compact);

        return (
          <NavigationList.Item key={rowId} id={rowId} disabled={isRemoved}>
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
                    <Text color={tone.secondary} wrap="truncate-start">
                      {subtitle}
                    </Text>
                  </Box>
                ) : null}
              </Box>
            )}
          </NavigationList.Item>
        );
      })}
    </NavigationList>
  );
}
