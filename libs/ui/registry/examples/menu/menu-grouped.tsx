import { Menu, MenuGroup, MenuItem } from "@/components/ui/menu";

export default function MenuGrouped() {
  return (
    <div className="w-64 border border-border">
      <Menu aria-label="Editor actions">
        <MenuGroup label="FILE">
          <MenuItem id="new" hotkey={1}>
            New File
          </MenuItem>
          <MenuItem id="open" hotkey={2}>
            Open File
          </MenuItem>
          <MenuItem id="save" hotkey={3}>
            Save
          </MenuItem>
        </MenuGroup>
        <MenuGroup label="EDIT">
          <MenuItem id="undo" hotkey={4}>
            Undo
          </MenuItem>
          <MenuItem id="redo" hotkey={5}>
            Redo
          </MenuItem>
          <MenuItem id="find" hotkey={6}>
            Find
          </MenuItem>
        </MenuGroup>
        <MenuGroup label="VIEW">
          <MenuItem id="terminal" hotkey={7}>
            Terminal
          </MenuItem>
          <MenuItem id="sidebar" hotkey={8}>
            Sidebar
          </MenuItem>
          <MenuItem id="minimap" hotkey={9}>
            Minimap
          </MenuItem>
        </MenuGroup>
      </Menu>
    </div>
  );
}
