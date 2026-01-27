import { Menu, Panel } from '@/components/ui';

interface HomeMenuProps {
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate: (id: string) => void;
}

export function HomeMenu({ selectedIndex, onSelect, onActivate }: HomeMenuProps) {
  return (
    <Panel className="w-full max-w-md lg:w-1/2 lg:max-w-lg h-fit flex flex-col">
      <Panel.Header variant="subtle">Main Menu</Panel.Header>
      <div className="flex flex-col py-2">
        <Menu
          selectedIndex={selectedIndex}
          onSelect={onSelect}
          onActivate={(item) => onActivate(item.id)}
          enableNumberJump
        >
          <Menu.Item id="review-unstaged">Review Unstaged</Menu.Item>
          <Menu.Item id="review-staged">Review Staged</Menu.Item>
          <Menu.Item id="review-files">Review Files...</Menu.Item>
          <Menu.Divider />
          <Menu.Item id="resume">Resume Last Review</Menu.Item>
          <Menu.Item id="history">History</Menu.Item>
          <Menu.Item id="settings">Settings</Menu.Item>
          <Menu.Divider />
          <Menu.Item id="help">Help</Menu.Item>
          <Menu.Item id="quit" variant="danger">Quit</Menu.Item>
        </Menu>
      </div>
    </Panel>
  );
}
