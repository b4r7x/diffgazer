import { Menu, MenuItem, MenuDivider, Panel, PanelHeader } from '@/components/ui';
import { getMenuItemsForContext, type MenuItem as CoreMenuItem } from "@repo/core";

interface HomeMenuProps {
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate: (id: string) => void;
}

function groupItems(items: CoreMenuItem[]) {
  const groups = { review: [] as CoreMenuItem[], navigation: [] as CoreMenuItem[], system: [] as CoreMenuItem[] };
  for (const item of items) {
    if (item.group) groups[item.group].push(item);
  }
  return groups;
}

export function HomeMenu({ selectedIndex, onSelect, onActivate }: HomeMenuProps) {
  const menuItems = getMenuItemsForContext("web");
  const { review, navigation, system } = groupItems(menuItems);

  return (
    <Panel className="w-full max-w-md lg:w-1/2 lg:max-w-lg h-fit flex flex-col">
      <PanelHeader variant="subtle">Main Menu</PanelHeader>
      <div className="flex flex-col py-2">
        <Menu
          selectedIndex={selectedIndex}
          onSelect={onSelect}
          onActivate={(item) => onActivate(item.id)}
          enableNumberJump
        >
          {review.map((item) => (
            <MenuItem key={item.id} id={item.id}>{item.label}</MenuItem>
          ))}
          <MenuDivider />
          {navigation.map((item) => (
            <MenuItem key={item.id} id={item.id}>{item.label}</MenuItem>
          ))}
          <MenuDivider />
          {system.map((item) => (
            <MenuItem key={item.id} id={item.id} variant={item.variant}>{item.label}</MenuItem>
          ))}
        </Menu>
      </div>
    </Panel>
  );
}
