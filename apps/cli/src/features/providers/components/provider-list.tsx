import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { NavigationList } from "../../../components/ui/navigation-list.js";
import { Badge } from "../../../components/ui/badge.js";

export interface ProviderListItem {
  id: string;
  name: string;
  displayStatus: "active" | "configured" | "needs-key";
  model?: string;
}

interface ProviderListProps {
  providers: ProviderListItem[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  isActive?: boolean;
}

function statusBadge(displayStatus: ProviderListItem["displayStatus"]): {
  variant: "success" | "info" | "neutral";
  label: string;
} {
  switch (displayStatus) {
    case "active":
      return { variant: "success", label: "active" };
    case "configured":
      return { variant: "info", label: "configured" };
    case "needs-key":
      return { variant: "neutral", label: "needs key" };
  }
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
        const badge = statusBadge(provider.displayStatus);
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
