import type { Shortcut } from "@/types/ui";

export type MenuAction =
  | "review-unstaged"
  | "review-staged"
  | "review-files"
  | "resume-review"
  | "history"
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

export const MENU_ITEMS: MenuItem[] = [
  { id: "review-unstaged", label: "Review Unstaged", shortcut: "r", group: "review" },
  { id: "review-staged", label: "Review Staged", shortcut: "R", group: "review" },
  { id: "resume-review", label: "Resume Last Review", shortcut: "l", group: "review" },
  { id: "history", label: "History", shortcut: "h", group: "navigation" },
  { id: "settings", label: "Settings", shortcut: "s", group: "navigation" },
  { id: "help", label: "Help", shortcut: "?", group: "system" },
  { id: "quit", label: "Quit", shortcut: "q", variant: "danger", group: "system" },
];

export const MAIN_MENU_SHORTCUTS: Shortcut[] = [
  { key: "↑/↓", label: "Select" },
  { key: "Enter", label: "Open" },
  { key: "q", label: "Quit" },
];
