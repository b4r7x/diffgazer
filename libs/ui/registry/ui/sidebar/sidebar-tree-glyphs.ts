/** Tree connector glyphs for the sidebar `tree` variant (TUI directory-tree aesthetic). */
export const SIDEBAR_TREE_CONNECTOR = {
  branch: "├─",
  last: "└─",
} as const;

/** Root nav element (standalone or within SidebarProvider). Owns variant + autoTone. */
export const SIDEBAR_TREE_CARET = {
  expanded: "▼",
  collapsed: "▶",
} as const;
