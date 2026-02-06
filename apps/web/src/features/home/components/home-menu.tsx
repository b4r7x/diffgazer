import { Menu, MenuDivider, MenuItem } from "@/components/ui/menu";
import { Panel, PanelHeader } from "@/components/ui/containers";

export interface MenuItemDefinition {
  id: string;
  label: string;
  shortcut?: string;
  variant?: "default" | "danger";
  group: "review" | "navigation" | "system";
}

interface HomeMenuProps {
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate: (id: string) => void;
  items: MenuItemDefinition[];
  isTrusted?: boolean;
  hasLastReview?: boolean;
}

function groupItems(items: MenuItemDefinition[]) {
  return items.reduce(
    (groups, item) => {
      if (item.group) groups[item.group].push(item);
      return groups;
    },
    {
      review: [] as MenuItemDefinition[],
      navigation: [] as MenuItemDefinition[],
      system: [] as MenuItemDefinition[],
    }
  );
}

export function HomeMenu({
  selectedIndex,
  onSelect,
  onActivate,
  items,
  isTrusted = false,
  hasLastReview = false,
}: HomeMenuProps) {
  const { review, navigation, system } = groupItems(items);
  const reviewDisabled = !isTrusted;
  const resumeDisabled = reviewDisabled || !hasLastReview;

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
          {review.map((item) => {
            const disabled = item.id === "resume-review" ? resumeDisabled : reviewDisabled;
            return (
              <MenuItem key={item.id} id={item.id} disabled={disabled}>
                {item.label}
              </MenuItem>
            );
          })}
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
      </div>
    </Panel>
  );
}
