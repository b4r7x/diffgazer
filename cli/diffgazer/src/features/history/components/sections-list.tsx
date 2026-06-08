import type { TimelineItem } from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { NavigationList } from "../../../components/ui/navigation-list";
import { useTheme } from "../../../theme/provider";

export interface SectionsListProps {
  items: TimelineItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  onHighlightChange?: (id: string) => void;
  isActive?: boolean;
}

export function SectionsList({
  items,
  selectedId,
  onSelect,
  onHighlightChange,
  isActive = true,
}: SectionsListProps): ReactElement {
  const { tokens } = useTheme();

  return (
    <Box flexDirection="column" padding={1}>
      <NavigationList
        selectedId={selectedId}
        highlightedId={isActive ? selectedId : null}
        onSelect={onSelect}
        onHighlightChange={onHighlightChange}
        isActive={isActive}
        wrap={false}
      >
        {items.map((item) => (
          <NavigationList.Item key={item.id} id={item.id}>
            <Box flexDirection="row" gap={1}>
              <NavigationList.Title>{item.label}</NavigationList.Title>
              <Box flexGrow={1} />
              <Text color={tokens.muted}>{item.count}</Text>
            </Box>
          </NavigationList.Item>
        ))}
      </NavigationList>
    </Box>
  );
}
