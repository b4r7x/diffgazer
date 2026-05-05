import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { DisplayStatus } from "@diffgazer/core/schemas/config";
import { getDisplayStatusBadge } from "@diffgazer/core/providers";
import { useTheme } from "../../../theme/theme-context.js";
import { NavigationList } from "../../../components/ui/navigation-list.js";
import { Badge } from "../../../components/ui/badge.js";

export interface ProviderListItem {
  id: string;
  name: string;
  displayStatus: DisplayStatus;
  model?: string;
}

interface ProviderListProps {
  providers: ProviderListItem[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  isActive?: boolean;
}

export function ProviderList({
  providers,
  selectedId,
  onSelect,
  isActive = true,
}: ProviderListProps): ReactElement {
  const { tokens } = useTheme();

  return (
    <NavigationList
      selectedId={selectedId}
      onSelect={onSelect}
      isActive={isActive}
    >
      {providers.map((provider) => {
        const badge = getDisplayStatusBadge(provider.displayStatus);
        return (
          <NavigationList.Item key={provider.id} id={provider.id}>
            <Box gap={1}>
              <NavigationList.Title>{provider.name}</NavigationList.Title>
              <Badge variant={badge.variant} dot>
                {badge.label}
              </Badge>
              {provider.model && (
                <Text color={tokens.muted}>{provider.model}</Text>
              )}
            </Box>
          </NavigationList.Item>
        );
      })}
    </NavigationList>
  );
}
