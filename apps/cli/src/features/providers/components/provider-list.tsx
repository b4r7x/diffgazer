import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { NavigationList } from "../../../components/ui/navigation-list.js";
import { Badge } from "../../../components/ui/badge.js";

interface Provider {
  id: string;
  name: string;
  status: "configured" | "unconfigured";
  model?: string;
}

interface ProviderListProps {
  providers: Provider[];
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
      {providers.map((provider) => (
        <NavigationList.Item key={provider.id} id={provider.id}>
          <Box gap={1}>
            <NavigationList.Title>{provider.name}</NavigationList.Title>
            <Badge
              variant={provider.status === "configured" ? "success" : "neutral"}
              dot
            >
              {provider.status}
            </Badge>
            {provider.model && (
              <Text color={tokens.muted}>{provider.model}</Text>
            )}
          </Box>
        </NavigationList.Item>
      ))}
    </NavigationList>
  );
}
