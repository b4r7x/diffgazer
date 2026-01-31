import type { Shortcut } from "@repo/schemas/ui";

// ============================================================================
// Menu Actions (shared between CLI and Web)
// ============================================================================

/**
 * Core menu actions shared by CLI and Web.
 * CLI extends this with 'open-web' for launching the web UI.
 */
export type MenuAction =
  | "review-unstaged"
  | "review-staged"
  | "review-files"
  | "resume-review"
  | "history"
  | "settings"
  | "help"
  | "quit";

// ============================================================================
// Menu Items
// ============================================================================

export interface MenuItem {
  id: MenuAction;
  label: string;
  shortcut?: string;
  variant?: "default" | "danger";
  group: "review" | "navigation" | "system";
}

/**
 * Core menu items shared by CLI and Web.
 * CLI adds 'open-web' item separately.
 */
export const MENU_ITEMS: MenuItem[] = [
  { id: "review-unstaged", label: "Review Unstaged", shortcut: "r", group: "review" },
  { id: "review-staged", label: "Review Staged", shortcut: "R", group: "review" },
  { id: "review-files", label: "Review Files...", shortcut: "f", group: "review" },
  { id: "resume-review", label: "Resume Last Review", shortcut: "l", group: "review" },
  { id: "history", label: "History", shortcut: "h", group: "navigation" },
  { id: "settings", label: "Settings", shortcut: "s", group: "navigation" },
  { id: "help", label: "Help", shortcut: "?", group: "system" },
  { id: "quit", label: "Quit", shortcut: "q", variant: "danger", group: "system" },
];

// ============================================================================
// Settings Menu
// ============================================================================

export type SettingsAction = "trust" | "theme" | "provider" | "diagnostics";

export interface SettingsMenuItem {
  id: SettingsAction;
  label: string;
  description: string;
}

export const SETTINGS_MENU_ITEMS: SettingsMenuItem[] = [
  { id: "trust", label: "Trust & Permissions", description: "Manage directory trust and capabilities" },
  { id: "theme", label: "Theme", description: "Change color theme preferences" },
  { id: "provider", label: "Provider", description: "Select AI provider for code review" },
  { id: "diagnostics", label: "Diagnostics", description: "Run system health checks" },
];

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

export const MAIN_MENU_SHORTCUTS: Shortcut[] = [
  { key: "↑/↓", label: "Select" },
  { key: "Enter", label: "Open" },
  { key: "q", label: "Quit" },
];

export const SETTINGS_SHORTCUTS: Shortcut[] = [
  { key: "↑/↓", label: "Select" },
  { key: "Enter", label: "Edit" },
  { key: "Esc", label: "Back" },
];
