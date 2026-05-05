import { Menu, MenuItem } from "@/components/ui/menu"

export default function MenuNested() {
  return (
    <div className="w-80 border border-border">
      <Menu variant="hub" aria-label="Project menu">
        <MenuItem id="overview" value="12 files">
          Overview
        </MenuItem>
        <MenuItem id="files" value="Modified">
          Source Files
        </MenuItem>
        <MenuItem id="tests" value="Passing" valueVariant="success">
          Test Suite
        </MenuItem>
        <MenuItem id="config" value="3 warnings" valueVariant="muted">
          Configuration
        </MenuItem>
      </Menu>
    </div>
  )
}
