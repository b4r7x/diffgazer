import { getDisplayStatusBadge } from "@diffgazer/core/providers";
import type { AIProvider, DisplayStatus } from "@diffgazer/core/schemas/config";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { Badge } from "../../../components/ui/badge";
import { NavigationList } from "../../../components/ui/navigation-list";
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
  onSelect?: (id: string) => void;
  isActive?: boolean;
  contentWidth: number;
  compact?: boolean;
}

export function ProviderList({
  providers,
  selectedId,
  onSelect,
  isActive = true,
  contentWidth,
  compact = false,
}: ProviderListProps): ReactElement {
  const { tokens } = useTheme();

  return (
    <NavigationList selectedId={selectedId} onSelect={onSelect} isActive={isActive}>
      {providers.map((provider) => {
        const badge = getDisplayStatusBadge(provider.displayStatus);
        return (
          <NavigationList.Item key={provider.id} id={provider.id}>
            <Box gap={1} width={contentWidth} flexWrap="nowrap" overflow="hidden">
              <Box flexGrow={1} minWidth={1} overflow="hidden">
                <Text bold wrap="truncate-end">
                  {provider.name}
                </Text>
              </Box>
              <Box flexShrink={0}>
                <Badge variant={badge.variant} dot>
                  {badge.label}
                </Badge>
              </Box>
              {!compact && provider.model ? (
                <Box flexShrink={1} overflow="hidden">
                  <Text color={tokens.muted} wrap="truncate-start">
                    {provider.model}
                  </Text>
                </Box>
              ) : null}
            </Box>
          </NavigationList.Item>
        );
      })}
    </NavigationList>
  );
}
