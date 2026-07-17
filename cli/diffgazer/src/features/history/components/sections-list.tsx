import type { TimelineItem } from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { NavigationList } from "../../../components/ui/navigation-list";
import { getVisibleSliceOffset } from "../../../lib/visible-slice-offset";
import { useTheme } from "../../../theme/provider";

export interface SectionsListProps {
  items: TimelineItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  onHighlightChange?: (id: string) => void;
  isActive?: boolean;
  height: number;
  width: number;
}

export function SectionsList({
  items,
  selectedId,
  onSelect,
  onHighlightChange,
  isActive = true,
  height,
  width,
}: SectionsListProps): ReactElement {
  const { tokens } = useTheme();
  const itemWidth = Math.max(width - 4, 1);
  const paddingY = height >= 3 ? 1 : 0;
  const visibleItemCount = Math.max(height - paddingY * 2, 1);
  const selectedIndex = Math.max(
    items.findIndex((item) => item.id === selectedId),
    0,
  );
  const offset = getVisibleSliceOffset(selectedIndex, items.length, visibleItemCount);
  const visibleItems = items.slice(offset, offset + visibleItemCount);

  return (
    <Box
      width={width}
      flexDirection="column"
      paddingX={1}
      paddingY={paddingY}
      height={height}
      overflow="hidden"
    >
      <NavigationList
        selectedId={selectedId}
        highlightedId={isActive ? selectedId : null}
        onSelect={onSelect}
        onHighlightChange={onHighlightChange}
        isActive={isActive}
        wrap={false}
        navigationItems={items.map((item) => ({ id: item.id, disabled: false }))}
      >
        {visibleItems.map((item) => (
          <NavigationList.Item key={item.id} id={item.id}>
            <Box width={itemWidth} flexDirection="row" gap={itemWidth > 2 ? 1 : 0}>
              <Box flexGrow={1} flexShrink={1} minWidth={0}>
                <Text color={tokens.fg} bold wrap="truncate-end">
                  {item.label}
                </Text>
              </Box>
              <Box flexShrink={1} maxWidth={Math.max(itemWidth - 2, 1)}>
                <Text color={tokens.muted} wrap="truncate-end">
                  {item.count}
                </Text>
              </Box>
            </Box>
          </NavigationList.Item>
        ))}
      </NavigationList>
    </Box>
  );
}
