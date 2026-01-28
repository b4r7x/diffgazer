import { Menu, MenuItem, MenuDivider, Panel, PanelHeader } from '@/components/ui';

interface HomeMenuProps {
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate: (id: string) => void;
}

export function HomeMenu({ selectedIndex, onSelect, onActivate }: HomeMenuProps) {
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
          <MenuItem id="review-unstaged">Review Unstaged</MenuItem>
          <MenuItem id="review-staged">Review Staged</MenuItem>
          <MenuItem id="review-files">Review Files...</MenuItem>
          <MenuDivider />
          <MenuItem id="resume">Resume Last Review</MenuItem>
          <MenuItem id="history">History</MenuItem>
          <MenuItem id="settings">Settings</MenuItem>
          <MenuDivider />
          <MenuItem id="help">Help</MenuItem>
          <MenuItem id="quit" variant="danger">Quit</MenuItem>
        </Menu>
      </div>
    </Panel>
  );
}
