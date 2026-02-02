import { Menu, MenuItem, MenuDivider, Panel, PanelHeader } from '@/components/ui';
import { MENU_ITEMS, type MenuItem as NavMenuItem } from "@repo/core";

interface HomeMenuProps {
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate: (id: string) => void;
  isTrusted?: boolean;
  hasLastReview?: boolean;
}

const GROUPED_ITEMS = MENU_ITEMS.reduce(
  (groups, item) => {
    if (item.group) groups[item.group].push(item);
    return groups;
  },
  { review: [] as NavMenuItem[], navigation: [] as NavMenuItem[], system: [] as NavMenuItem[] }
);

export function HomeMenu({ selectedIndex, onSelect, onActivate, isTrusted = false, hasLastReview = false }: HomeMenuProps) {
  const { review, navigation, system } = GROUPED_ITEMS;

  const isDisabled = (id: string): boolean => {
    if (id === "resume-review") return !hasLastReview;
    return !isTrusted;
  };

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
            <MenuItem key={item.id} id={item.id} disabled={isDisabled(item.id)}>{item.label}</MenuItem>
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
