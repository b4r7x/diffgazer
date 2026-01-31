import { MENU_ITEMS as CORE_MENU_ITEMS } from "@repo/core";

// ============================================================================
// CLI-specific Menu Action (extends core with 'open-web')
// ============================================================================

/**
 * CLI menu action extends core actions with 'open-web' for launching the web UI.
 */
export type MenuAction =
  | "review-unstaged"
  | "review-staged"
  | "review-files"
  | "resume-review"
  | "history"
  | "open-web"
  | "settings"
  | "help"
  | "quit";

export interface MenuItem {
  id: MenuAction;
  label: string;
  shortcut?: string;
  variant?: "default" | "danger";
  group: "review" | "navigation" | "system";
}

/**
 * CLI menu items - includes 'open-web' for launching web UI.
 */
export const MENU_ITEMS: MenuItem[] = [
  ...CORE_MENU_ITEMS.filter((item) => item.group === "review"),
  { id: "history", label: "History", shortcut: "h", group: "navigation" },
  { id: "open-web", label: "Open Web UI", shortcut: "w", group: "navigation" },
  { id: "settings", label: "Settings", shortcut: "s", group: "navigation" },
  ...CORE_MENU_ITEMS.filter((item) => item.group === "system"),
] as MenuItem[];
