import type { ReactElement } from "react";
import { Box } from "ink";
import { MENU_ITEMS, type MenuItem } from "../../../lib/navigation.js";
import { Panel, PanelHeader } from "../../../components/ui/layout/panel.js";
import { Menu, MenuItem as MenuItemComponent, MenuDivider } from "../../../components/ui/menu.js";

interface HomeMenuProps {
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate: (id: string) => void;
  hasLastReview?: boolean;
  isActive?: boolean;
  width?: number;
}

function groupItems(items: MenuItem[]) {
  const groups = {
    review: [] as MenuItem[],
    navigation: [] as MenuItem[],
    system: [] as MenuItem[],
  };
  for (const item of items) {
    const group = item.group;
    if (group && group in groups) {
      groups[group as keyof typeof groups].push(item);
    }
  }
  return groups;
}

export function HomeMenu({
  selectedIndex,
  onSelect,
  onActivate,
  hasLastReview = false,
  isActive = true,
  width = 32,
}: HomeMenuProps): ReactElement {
  const { review, navigation, system } = groupItems(MENU_ITEMS);

  // Menu width is panel width minus border (2 chars)
  const menuWidth = width - 2;

  return (
    <Panel width={width}>
      <PanelHeader variant="subtle">Main Menu</PanelHeader>
      <Box flexDirection="column" paddingY={1}>
        <Menu
          selectedIndex={selectedIndex}
          onSelect={onSelect}
          onActivate={(item) => onActivate(item.id)}
          isActive={isActive}
          enableNumberJump
          width={menuWidth}
        >
          {review.map((item) => (
            <MenuItemComponent
              key={item.id}
              id={item.id}
              disabled={item.id === "resume-review" && !hasLastReview}
            >
              {item.label}
            </MenuItemComponent>
          ))}
          <MenuDivider />
          {navigation.map((item) => (
            <MenuItemComponent key={item.id} id={item.id}>
              {item.label}
            </MenuItemComponent>
          ))}
          <MenuDivider />
          {system.map((item) => (
            <MenuItemComponent key={item.id} id={item.id} variant={item.variant}>
              {item.label}
            </MenuItemComponent>
          ))}
        </Menu>
      </Box>
    </Panel>
  );
}
