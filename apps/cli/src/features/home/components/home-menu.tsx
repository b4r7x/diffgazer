import type { ReactElement } from "react";
import { Box } from "ink";
import { getMenuItemsForContext, type MenuItem as CoreMenuItem } from "@repo/core";
import { Panel, PanelHeader } from "../../../components/ui/panel.js";
import { Menu, MenuItem, MenuDivider } from "../../../components/ui/menu.js";

interface HomeMenuProps {
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate: (id: string) => void;
  hasLastReview?: boolean;
  isActive?: boolean;
}

function groupItems(items: CoreMenuItem[]) {
  const groups = {
    review: [] as CoreMenuItem[],
    navigation: [] as CoreMenuItem[],
    system: [] as CoreMenuItem[],
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
}: HomeMenuProps): ReactElement {
  const menuItems = getMenuItemsForContext("cli");
  const { review, navigation, system } = groupItems(menuItems);

  return (
    <Panel>
      <PanelHeader variant="subtle">Main Menu</PanelHeader>
      <Box flexDirection="column" paddingY={1}>
        <Menu
          selectedIndex={selectedIndex}
          onSelect={onSelect}
          onActivate={(item) => onActivate(item.id)}
          isActive={isActive}
          enableNumberJump
        >
          {review.map((item) => (
            <MenuItem
              key={item.id}
              id={item.id}
              disabled={item.id === "resume-review" && !hasLastReview}
            >
              {item.label}
            </MenuItem>
          ))}
          <MenuDivider />
          {navigation.map((item) => (
            <MenuItem key={item.id} id={item.id}>
              {item.label}
            </MenuItem>
          ))}
          <MenuDivider />
          {system.map((item) => (
            <MenuItem key={item.id} id={item.id} variant={item.variant}>
              {item.label}
            </MenuItem>
          ))}
        </Menu>
      </Box>
    </Panel>
  );
}
