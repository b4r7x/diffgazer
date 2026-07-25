import { Menu, MenuDivider, MenuItem } from "@/components/ui/menu";

/**
 * Disabled items stay in the navigation order and keep announcing themselves,
 * they just cannot be activated. The highlight still lands on them so keyboard
 * users learn the item exists.
 */
export default function MenuDisabled() {
  return (
    <div className="w-64 border border-border">
      <Menu aria-label="File actions" defaultHighlighted="paste">
        <MenuItem id="copy" hotkey={1}>
          Copy
        </MenuItem>
        <MenuItem id="paste" hotkey={2} disabled>
          Paste
        </MenuItem>
        <MenuItem id="duplicate" hotkey={3} disabled>
          Duplicate
        </MenuItem>
        <MenuDivider />
        <MenuItem id="delete" variant="danger" disabled>
          Delete
        </MenuItem>
      </Menu>
    </div>
  );
}
