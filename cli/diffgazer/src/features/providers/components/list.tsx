import type { AIProvider, DisplayStatus } from "@diffgazer/core/schemas/config";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { NavigationList } from "../../../components/ui/navigation-list";
import type { CliColorTokens } from "../../../theme/palettes";
import { useTheme } from "../../../theme/provider";

export interface ProviderListItem {
  id: AIProvider;
  name: string;
  displayStatus: DisplayStatus;
  model?: string;
}

interface ProviderListProps {
  providers: ProviderListItem[];
  selectedId?: string;
  highlightedId?: string;
  onSelect?: (id: string) => void;
  onHighlightChange?: (id: string) => void;
  isActive?: boolean;
  contentWidth: number;
  compact?: boolean;
}

/**
 * Status is a one-cell glyph so the row spends its width on the name it is
 * chosen by. The three glyphs differ in shape, so status survives a monochrome
 * terminal; the spelled-out status lives in the details pane.
 */
const STATUS_GLYPH: Record<DisplayStatus, string> = {
  active: "●",
  configured: "○",
  "needs-key": "!",
};

function getStatusColor(status: DisplayStatus, tokens: CliColorTokens): string {
  if (status === "active") return tokens.success;
  if (status === "needs-key") return tokens.warning;
  return tokens.muted;
}

export function ProviderList({
  providers,
  selectedId,
  highlightedId,
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
      {providers.map((provider) => (
        <NavigationList.Item key={provider.id} id={provider.id}>
          {({ tone }) => (
            <Box gap={1} width={contentWidth} flexWrap="nowrap" overflow="hidden">
              <Box flexShrink={0}>
                <Text
                  color={
                    tone.background ? tone.primary : getStatusColor(provider.displayStatus, tokens)
                  }
                >
                  {STATUS_GLYPH[provider.displayStatus]}
                </Text>
              </Box>
              <Box flexGrow={1} minWidth={1} overflow="hidden">
                <Text color={tone.primary} bold wrap="truncate-end">
                  {provider.name}
                </Text>
              </Box>
              {!compact && provider.model ? (
                <Box flexShrink={1} overflow="hidden">
                  <Text color={tone.secondary} wrap="truncate-start">
                    {provider.model}
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
