import { Menu, MenuItem, MenuDivider } from "@/components/ui/menu"

export default function MenuDefault() {
  return (
    <div className="w-64 border border-border">
      <Menu aria-label="File actions">
        <MenuItem id="new" hotkey={1}>New File</MenuItem>
        <MenuItem id="open" hotkey={2}>Open File</MenuItem>
        <MenuItem id="save" hotkey={3}>Save</MenuItem>
        <MenuDivider />
        <MenuItem id="delete" variant="danger">Delete</MenuItem>
      </Menu>
    </div>
  )
}
